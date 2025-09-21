import React, { useRef, useState } from "react";
import Layout from "@components/Layout";
import { AuthTabs, EmailPasswordForm, PhoneAuthSection, SocialButtons } from "@components/auth";
import type { EmailPasswordPayload } from "@components/auth";
import { auth, googleProvider, makeRecaptcha } from "@utils/firebaseClient";
import {
    ConfirmationResult,
    signInWithEmailAndPassword,
    signInWithPhoneNumber,
    signInWithPopup,
} from "firebase/auth";
import axios, { type ApiResponse } from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import { logout, setTokens, setUser } from "@store/authSlice";
import { useRouter } from "next/router";
import { clearTokens, clearUser, saveTokens, saveUser } from "@utils/tokenStorage";
import type { UserRecord } from "@/types";

const OTP_ERROR_DEFAULT = "OTP confirm failed";
type Tab = "login" | "signup";

type AuthTokens = { accessToken: string; refreshToken: string };
type AuthSuccessBody = AuthTokens & { user: UserRecord };

function extractAuth(body: AuthSuccessBody | null | undefined): { tokens: AuthTokens; user: UserRecord } {
    if (!body?.accessToken || !body?.refreshToken || !body?.user) {
        throw new Error("Invalid authentication response");
    }
    return {
        tokens: {
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
        },
        user: body.user,
    };
}

export default function LoginSignupPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("login");

    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const confirmRef = useRef<ConfirmationResult | null>(null);

    const boot = () => {
        setMessage("");
        setLastError(null);
    };

    const finishLogin = async (idToken: string) => {
        const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/login", { idToken });
        const { tokens, user } = extractAuth(response.data.body);
        dispatch(setTokens(tokens));
        dispatch(setUser(user));
        saveTokens(tokens);
        saveUser(user);
        router.replace("/");
    };

    const finishSignupWithIdToken = async (idToken: string, provider: "google" | "phone") => {
        const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/signup", { provider, idToken });
        const { tokens, user } = extractAuth(response.data.body);
        dispatch(setTokens(tokens));
        dispatch(setUser(user));
        saveTokens(tokens);
        saveUser(user);
        router.replace("/");
    };

    const onLoginEmail = async ({ email, password }: EmailPasswordPayload) => {
        try {
            boot();
            setSubmitting(true);
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await credential.user.getIdToken();
            await finishLogin(idToken);
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Login failed";
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
            throw new Error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupEmail = async ({ email, password, sendVerifyEmail }: EmailPasswordPayload) => {
        try {
            boot();
            setSubmitting(true);
            if (!email || !password) throw new Error("Email and password required");
            const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/signup", {
                provider: "password",
                email,
                password,
                sendVerifyEmail,
            });
            const { tokens, user } = extractAuth(response.data.body);
            dispatch(setTokens(tokens));
            dispatch(setUser(user));
            saveTokens(tokens);
            saveUser(user);
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch {
                /* ignore */
            }
            router.replace("/");
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Signup failed";
            const code = error?.response?.data?.code || error?.code;
            setLastError({ code, message: msg });
            setMessage(msg);
            throw new Error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const onLoginGoogle = async () => {
        try {
            boot();
            setSubmitting(true);
            const credential = await signInWithPopup(auth, googleProvider);
            const idToken = await credential.user.getIdToken();
            await finishLogin(idToken);
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Login failed";
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupGoogle = async () => {
        try {
            boot();
            setSubmitting(true);
            const credential = await signInWithPopup(auth, googleProvider);
            const idToken = await credential.user.getIdToken();
            await finishSignupWithIdToken(idToken, "google");
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || "Signup failed";
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const onLoginLine = async () => {
        try {
            dispatch(logout());
            clearTokens();
            clearUser();
            router.replace("/web-hook-line");
        } catch (error: any) {
            const msg = error?.message || "LINE login failed";
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
        }
    };

    const handleSocialGoogle = async () => {
        if (tab === "login") {
            await onLoginGoogle();
        } else {
            await onSignupGoogle();
        }
    };

    const handlePhoneSend = async (phoneNumber: string) => {
        boot();
        setSubmitting(true);
        try {
            const verifier = makeRecaptcha(tab === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp");
            const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
            confirmRef.current = confirmation;
            setMessage("OTP sent.");
        } catch (error: any) {
            const msg = error?.message || "OTP send failed";
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
            throw new Error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePhoneConfirm = async (code: string) => {
        setSubmitting(true);
        try {
            if (!confirmRef.current) {
                throw new Error("Send OTP first.");
            }
            if (!/^\d{6}$/.test(code)) {
                throw new Error("Enter the 6-digit OTP");
            }
            const result = await confirmRef.current.confirm(code);
            const idToken = await result.user.getIdToken();
            if (tab === "login") {
                await finishLogin(idToken);
            } else {
                await finishSignupWithIdToken(idToken, "phone");
            }
        } catch (error: any) {
            const msg = error?.message || OTP_ERROR_DEFAULT;
            setLastError({ code: error?.code, message: msg });
            setMessage(msg);
            throw new Error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout>
            <div className="min-h-[80vh] bg-gradient-to-b from-emerald-50/60 to-white flex items-center">
                <div className="w-full max-w-4xl mx-auto px-4">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium mb-3">
                            fresh • fast • foodie
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Welcome to BaanFoodie</h1>
                        <p className="text-slate-500 mt-1">Sign {tab === "login" ? "in" : "up"} to get your favorites faster.</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-3xl shadow-sm p-2">
                        <AuthTabs value={tab} onChange={setTab} />
                        <div className="grid md:grid-cols-2 gap-4 p-4 md:p-6">
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">Email &amp; Password</h2>
                                {tab === "login" ? (
                                    <EmailPasswordForm mode="login" onSubmit={onLoginEmail} submitting={submitting} />
                                ) : (
                                    <EmailPasswordForm mode="signup" onSubmit={onSignupEmail} submitting={submitting} />
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">Quick sign {tab === "login" ? "in" : "up"}</h2>
                                <SocialButtons mode={tab} onGoogle={handleSocialGoogle} onLine={onLoginLine} submitting={submitting} />
                                <div className="mt-4">
                                    <PhoneAuthSection
                                        mode={tab}
                                        onSendOtp={handlePhoneSend}
                                        onConfirmOtp={handlePhoneConfirm}
                                        submitting={submitting}
                                        buttonId={tab === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp"}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-4 pb-4 md:px-6 space-y-3">
                            {!!message && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>
                            )}
                            {!!lastError && (
                                <pre className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 overflow-x-auto">
{JSON.stringify(lastError, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>

                    <div className="text-center text-xs text-slate-500 mt-6">
                        © {new Date().getFullYear()} BaanFoodie. Fresh to your door.
                    </div>
                </div>
            </div>
        </Layout>
    );
}

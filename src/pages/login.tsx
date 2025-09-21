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
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
type Tab = "login" | "signup";

type AuthTokens = { accessToken: string; refreshToken: string };
type AuthSuccessBody = AuthTokens & { user: UserRecord };

function extractAuth(
    body: AuthSuccessBody | null | undefined,
    invalidMessage: string
): { tokens: AuthTokens; user: UserRecord } {
    if (!body?.accessToken || !body?.refreshToken || !body?.user) {
        throw new Error(invalidMessage);
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
    const { t } = useI18n();

    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const confirmRef = useRef<ConfirmationResult | null>(null);

    const brandName = t(I18N_KEYS.BRAND_NAME);
    const heroTagline = t(I18N_KEYS.AUTH_TAGLINE);
    const welcomeTitle = `${t(I18N_KEYS.AUTH_WELCOME_PREFIX)} ${brandName}`;
    const heroSubtitle = tab === "login" ? t(I18N_KEYS.AUTH_SUBTITLE_LOGIN) : t(I18N_KEYS.AUTH_SUBTITLE_SIGNUP);
    const quickTitle = tab === "login" ? t(I18N_KEYS.AUTH_QUICK_TITLE_LOGIN) : t(I18N_KEYS.AUTH_QUICK_TITLE_SIGNUP);

    const boot = () => {
        setMessage("");
        setLastError(null);
    };

    const finishLogin = async (idToken: string) => {
        const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/login", { idToken });
        const { tokens, user } = extractAuth(response.data.body, t(I18N_KEYS.AUTH_INVALID_RESPONSE));
        dispatch(setTokens(tokens));
        dispatch(setUser(user));
        saveTokens(tokens);
        saveUser(user);
        router.replace("/");
    };

    const finishSignupWithIdToken = async (idToken: string, provider: "google" | "phone") => {
        const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/signup", { provider, idToken });
        const { tokens, user } = extractAuth(response.data.body, t(I18N_KEYS.AUTH_INVALID_RESPONSE));
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
            const fallback = t(I18N_KEYS.AUTH_LOGIN_FAILED);
            const responseMessage = error?.response?.data?.message;
            const rawMessage = typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : error?.message;
            const resolved = typeof rawMessage === "string" && rawMessage.length > 0 ? rawMessage : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
            throw new Error(resolved);
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupEmail = async ({ email, password, sendVerifyEmail }: EmailPasswordPayload) => {
        try {
            boot();
            setSubmitting(true);
            if (!email || !password) throw new Error(t(I18N_KEYS.AUTH_EMAIL_PASSWORD_REQUIRED));
            const response = await axios.post<ApiResponse<AuthSuccessBody>>("/api/signup", {
                provider: "password",
                email,
                password,
                sendVerifyEmail,
            });
            const { tokens, user } = extractAuth(response.data.body, t(I18N_KEYS.AUTH_INVALID_RESPONSE));
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
            const fallback = t(I18N_KEYS.AUTH_SIGNUP_FAILED);
            const responseMessage = error?.response?.data?.message;
            const rawMessage = typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : error?.message;
            const resolved = typeof rawMessage === "string" && rawMessage.length > 0 ? rawMessage : fallback;
            const code = error?.response?.data?.code || error?.code;
            setLastError({ code, message: resolved });
            setMessage(resolved);
            throw new Error(resolved);
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
            const fallback = t(I18N_KEYS.AUTH_LOGIN_FAILED);
            const responseMessage = error?.response?.data?.message;
            const rawMessage = typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : error?.message;
            const resolved = typeof rawMessage === "string" && rawMessage.length > 0 ? rawMessage : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
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
            const fallback = t(I18N_KEYS.AUTH_SIGNUP_FAILED);
            const responseMessage = error?.response?.data?.message;
            const rawMessage = typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : error?.message;
            const resolved = typeof rawMessage === "string" && rawMessage.length > 0 ? rawMessage : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
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
            const fallback = t(I18N_KEYS.AUTH_LINE_LOGIN_FAILED);
            const resolved = typeof error?.message === "string" && error.message.length > 0 ? error.message : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
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
            setMessage(t(I18N_KEYS.AUTH_OTP_SENT));
        } catch (error: any) {
            const fallback = t(I18N_KEYS.AUTH_OTP_SEND_FAILED);
            const resolved = typeof error?.message === "string" && error.message.length > 0 ? error.message : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
            throw new Error(resolved);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePhoneConfirm = async (code: string) => {
        setSubmitting(true);
        try {
            if (!confirmRef.current) {
                throw new Error(t(I18N_KEYS.AUTH_SEND_OTP_FIRST));
            }
            if (!/^\d{6}$/.test(code)) {
                throw new Error(t(I18N_KEYS.AUTH_ENTER_OTP));
            }
            const result = await confirmRef.current.confirm(code);
            const idToken = await result.user.getIdToken();
            if (tab === "login") {
                await finishLogin(idToken);
            } else {
                await finishSignupWithIdToken(idToken, "phone");
            }
        } catch (error: any) {
            const fallback = t(I18N_KEYS.AUTH_OTP_DEFAULT_ERROR);
            const resolved = typeof error?.message === "string" && error.message.length > 0 ? error.message : fallback;
            setLastError({ code: error?.code, message: resolved });
            setMessage(resolved);
            throw new Error(resolved);
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
                            {heroTagline}
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">{welcomeTitle}</h1>
                        <p className="text-slate-500 mt-1">{heroSubtitle}</p>
                    </div>

                    <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-3xl shadow-sm p-2">
                        <AuthTabs value={tab} onChange={setTab} />
                        <div className="grid md:grid-cols-2 gap-4 p-4 md:p-6">
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">{t(I18N_KEYS.AUTH_EMAIL_PASSWORD_TITLE)}</h2>
                                {tab === "login" ? (
                                    <EmailPasswordForm mode="login" onSubmit={onLoginEmail} submitting={submitting} />
                                ) : (
                                    <EmailPasswordForm mode="signup" onSubmit={onSignupEmail} submitting={submitting} />
                                )}
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">{quickTitle}</h2>
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
                        © {new Date().getFullYear()} {brandName}. {t(I18N_KEYS.AUTH_COPYRIGHT_TAGLINE)}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

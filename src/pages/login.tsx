import React, { useRef, useState } from "react";
import Layout from "@components/Layout";
import { AuthTabs, EmailPasswordForm, PhoneAuthSection, SocialButtons } from "@components/auth";
import type { EmailPasswordPayload } from "@components/auth";
import { auth, googleProvider, makeRecaptcha } from "@utils/firebaseClient";
import {
    ConfirmationResult,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signInWithPhoneNumber,
    signInWithPopup,
} from "firebase/auth";
import { useAppDispatch } from "@store/index";
import { logout, setTokens, setUser } from "@store/authSlice";
import { useRouter } from "next/router";
import { clearCart, clearConfig, clearTokens, clearUser, saveTokens, saveUser } from "@utils/tokenStorage";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { loginWithFirebase } from "@/services/auth";

type Tab = "login" | "signup";

export default function LoginSignupPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("login");
    const { t } = useI18n();
    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const confirmRef = useRef<ConfirmationResult | null>(null);

    const finishLogin = async (idToken: string) => {
        const response = await loginWithFirebase(idToken);
        dispatch(setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken }));
        dispatch(setUser(response.user));
        saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
        saveUser(response.user);
        await router.replace("/");
    };

    const resetState = () => {
        setMessage("");
        setLastError(null);
    };

    const handleAuthError = (error: any, fallbackKey: string) => {
        const resolved = error?.response?.data?.message || error?.message || t(fallbackKey as any);
        setLastError({ code: error?.code, message: resolved });
        setMessage(resolved);
        throw new Error(resolved);
    };

    const onLoginEmail = async ({ email, password }: EmailPasswordPayload) => {
        resetState();
        setSubmitting(true);
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await credential.user.getIdToken();
            await finishLogin(idToken);
        } catch (error: any) {
            handleAuthError(error, I18N_KEYS.AUTH_LOGIN_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupEmail = async ({ email, password, sendVerifyEmail: shouldVerify }: EmailPasswordPayload) => {
        resetState();
        setSubmitting(true);
        try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            if (shouldVerify) {
                await sendEmailVerification(credential.user);
            }
            const idToken = await credential.user.getIdToken();
            await finishLogin(idToken);
            if (shouldVerify) {
                setMessage(t(I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT));
            }
        } catch (error: any) {
            handleAuthError(error, I18N_KEYS.AUTH_SIGNUP_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const onGoogle = async () => {
        resetState();
        setSubmitting(true);
        try {
            const credential = await signInWithPopup(auth, googleProvider);
            const idToken = await credential.user.getIdToken();
            await finishLogin(idToken);
        } catch (error: any) {
            setLastError({ code: error?.code, message: error?.message || t(I18N_KEYS.AUTH_LOGIN_FAILED) });
            setMessage(error?.message || t(I18N_KEYS.AUTH_LOGIN_FAILED));
        } finally {
            setSubmitting(false);
        }
    };

    const onLine = async () => {
        dispatch(logout());
        clearTokens();
        clearUser();
        clearCart();
        clearConfig();
        await router.replace("/web-hook-line");
    };

    const onPhoneSend = async (phoneNumber: string) => {
        resetState();
        setSubmitting(true);
        try {
            const verifier = makeRecaptcha(tab === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp");
            confirmRef.current = await signInWithPhoneNumber(auth, phoneNumber, verifier);
            setMessage(t(I18N_KEYS.AUTH_OTP_SENT));
        } catch (error: any) {
            handleAuthError(error, I18N_KEYS.AUTH_OTP_SEND_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const onPhoneConfirm = async (code: string) => {
        setSubmitting(true);
        try {
            if (!confirmRef.current) {
                throw new Error(t(I18N_KEYS.AUTH_SEND_OTP_FIRST));
            }
            const result = await confirmRef.current.confirm(code);
            const idToken = await result.user.getIdToken();
            await finishLogin(idToken);
        } catch (error: any) {
            handleAuthError(error, I18N_KEYS.AUTH_OTP_DEFAULT_ERROR);
        } finally {
            setSubmitting(false);
        }
    };

    const brandName = t(I18N_KEYS.BRAND_NAME);

    return (
        <Layout>
            <div className="min-h-[82vh] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_55%)] flex items-center">
                <div className="mx-auto w-full max-w-5xl px-4">
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {t(I18N_KEYS.AUTH_TAGLINE)}
                        </div>
                        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                            {t(I18N_KEYS.AUTH_WELCOME_PREFIX)} {brandName}
                        </h1>
                        <p className="mt-2 text-slate-500">
                            Use Firebase for identity and the Go backend for app sessions, cart, and order state.
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
                        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
                            <section className="bg-[linear-gradient(160deg,#052e2b_0%,#064e3b_38%,#10b981_115%)] p-8 text-white">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">Fast checkout stack</p>
                                <h2 className="mt-4 text-3xl font-semibold">Sign in once and keep your cart, wallet, and orders in sync.</h2>
                                <p className="mt-4 text-sm leading-6 text-emerald-50/85">
                                    This upgrade separates the mobile frontend from the backend service, so auth exchange, cart state,
                                    checkout, and payment verification all run through a dedicated Go API.
                                </p>
                            </section>

                            <section className="p-6 sm:p-8">
                                <AuthTabs value={tab} onChange={setTab} />
                                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                                    <div className="rounded-3xl border border-slate-200 p-5">
                                        <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.AUTH_EMAIL_PASSWORD_TITLE)}</h2>
                                        <div className="mt-4">
                                            {tab === "login" ? (
                                                <EmailPasswordForm mode="login" onSubmit={onLoginEmail} submitting={submitting} />
                                            ) : (
                                                <EmailPasswordForm mode="signup" onSubmit={onSignupEmail} submitting={submitting} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-slate-200 p-5">
                                        <h2 className="text-lg font-semibold text-slate-900">
                                            {tab === "login" ? t(I18N_KEYS.AUTH_QUICK_TITLE_LOGIN) : t(I18N_KEYS.AUTH_QUICK_TITLE_SIGNUP)}
                                        </h2>
                                        <div className="mt-4 space-y-4">
                                            <SocialButtons mode={tab} onGoogle={onGoogle} onLine={onLine} submitting={submitting} />
                                            <PhoneAuthSection
                                                mode={tab}
                                                onSendOtp={onPhoneSend}
                                                onConfirmOtp={onPhoneConfirm}
                                                submitting={submitting}
                                                buttonId={tab === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp"}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {message ? (
                                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                        {message}
                                    </div>
                                ) : null}
                                {lastError ? (
                                    <pre className="mt-3 overflow-x-auto rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
{JSON.stringify(lastError, null, 2)}
                                    </pre>
                                ) : null}
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

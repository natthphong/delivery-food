import Link from "next/link";
import React, { useRef, useState } from "react";
import { EmailPasswordForm, PhoneAuthSection, SocialButtons } from "@components/auth";
import type { EmailPasswordPayload } from "@components/auth";
import { FloatingLanguageToggle } from "@components/common";
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
import { resolveUiError } from "@/utils/uiErrors";

type AuthMode = "login" | "signup";

export type AuthScreenProps = {
    mode: AuthMode;
};

export default function AuthScreen({ mode }: AuthScreenProps) {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { t } = useI18n();
    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<string | null>(null);
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
        const parsed = resolveUiError(error, {
            fallbackKey,
            fallbackMessage: t(fallbackKey as any),
        });
        setLastError(parsed.message);
        setMessage("");
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
            handleAuthError(error, I18N_KEYS.AUTH_LOGIN_FAILED);
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
            const verifier = makeRecaptcha(mode === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp");
            confirmRef.current = await signInWithPhoneNumber(auth, phoneNumber, verifier);
            setMessage(t(I18N_KEYS.AUTH_OTP_SENT));
        } catch (error: any) {
            handleAuthError(error, I18N_KEYS.AUTH_OTP_SEND_FAILED);
        } finally {
            setSubmitting(false);
        }
    };

    const onPhoneConfirm = async (code: string) => {
        if (!confirmRef.current) {
            resetState();
            setLastError(t(I18N_KEYS.AUTH_SEND_OTP_FIRST));
            return;
        }
        setSubmitting(true);
        try {
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
    const title = mode === "login" ? t("auth.screenTitle.login" as any) : t("auth.screenTitle.signup" as any);
    const subtitle = mode === "login" ? t("auth.screenSubtitle.login" as any) : t("auth.screenSubtitle.signup" as any);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),linear-gradient(180deg,#f7fdf9_0%,#ffffff_55%,#ecfdf5_100%)]">
            <FloatingLanguageToggle />

            <main className="px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-6">
                        <Link href="/" className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
                            {brandName}
                        </Link>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                        <section className="rounded-[2.5rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#dcfce7_125%)] px-7 py-8 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t("auth.screenEyebrow" as any)}</p>
                            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
                            <p className="mt-3 max-w-xl text-base text-slate-600">{subtitle}</p>

                            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                <div className="rounded-[1.75rem] border border-white bg-white/85 p-4">
                                    <p className="text-sm font-semibold text-slate-900">{t("auth.cardEmailTitle" as any)}</p>
                                    <p className="mt-2 text-sm text-slate-600">{t("auth.cardEmailBody" as any)}</p>
                                </div>
                                <div className="rounded-[1.75rem] border border-white bg-white/85 p-4">
                                    <p className="text-sm font-semibold text-slate-900">{t("auth.cardPhoneTitle" as any)}</p>
                                    <p className="mt-2 text-sm text-slate-600">{t("auth.cardPhoneBody" as any)}</p>
                                </div>
                                <div className="rounded-[1.75rem] border border-white bg-white/85 p-4">
                                    <p className="text-sm font-semibold text-slate-900">{t("auth.cardProvidersTitle" as any)}</p>
                                    <p className="mt-2 text-sm text-slate-600">{t("auth.cardProvidersBody" as any)}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                                <Link
                                    href="/login"
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                                    aria-current={mode === "login" ? "page" : undefined}
                                >
                                    {t(I18N_KEYS.AUTH_LOGIN)}
                                </Link>
                                <Link
                                    href="/signup"
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                                    aria-current={mode === "signup" ? "page" : undefined}
                                >
                                    {t(I18N_KEYS.AUTH_SIGNUP)}
                                </Link>
                            </div>

                            <div className="mt-6 grid gap-4 xl:grid-cols-2">
                                <div className="rounded-[2rem] border border-slate-200 p-5">
                                    <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.AUTH_EMAIL_PASSWORD_TITLE)}</h2>
                                    <div className="mt-4">
                                        {mode === "login" ? (
                                            <EmailPasswordForm mode="login" onSubmit={onLoginEmail} submitting={submitting} />
                                        ) : (
                                            <EmailPasswordForm mode="signup" onSubmit={onSignupEmail} submitting={submitting} />
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-[2rem] border border-slate-200 p-5">
                                    <h2 className="text-lg font-semibold text-slate-900">
                                        {mode === "login" ? t(I18N_KEYS.AUTH_QUICK_TITLE_LOGIN) : t(I18N_KEYS.AUTH_QUICK_TITLE_SIGNUP)}
                                    </h2>
                                    <div className="mt-4 space-y-4">
                                        <SocialButtons mode={mode} onGoogle={onGoogle} onLine={onLine} submitting={submitting} />
                                        <PhoneAuthSection
                                            mode={mode}
                                            onSendOtp={onPhoneSend}
                                            onConfirmOtp={onPhoneConfirm}
                                            submitting={submitting}
                                            buttonId={mode === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp"}
                                        />
                                    </div>
                                </div>
                            </div>

                            {message ? (
                                <div className="mt-5 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                    {message}
                                </div>
                            ) : null}
                            {lastError ? (
                                <div className="mt-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                                    {lastError}
                                </div>
                            ) : null}
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}

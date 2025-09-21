import React, { useEffect, useState } from "react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type EmailPasswordPayload = {
    email: string;
    password: string;
    confirmPassword?: string;
    sendVerifyEmail?: boolean;
};

export type EmailPasswordFormProps = {
    mode: "login" | "signup";
    onSubmit: (payload: EmailPasswordPayload) => Promise<void> | void;
    submitting: boolean;
};

const EmailPasswordForm: React.FC<EmailPasswordFormProps> = ({ mode, onSubmit, submitting }) => {
    const { t } = useI18n();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [sendVerifyEmail, setSendVerifyEmail] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setSendVerifyEmail(true);
        setError(null);
    }, [mode]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!email || !password) {
            setError(t(I18N_KEYS.AUTH_EMAIL_PASSWORD_REQUIRED));
            return;
        }

        if (mode === "signup" && password !== confirmPassword) {
            setError(t(I18N_KEYS.AUTH_PASSWORD_MISMATCH));
            return;
        }

        await onSubmit({
            email,
            password,
            ...(mode === "signup"
                ? { confirmPassword, sendVerifyEmail }
                : {}),
        });
    };

    const submitLabel = mode === "login" ? t(I18N_KEYS.AUTH_SIGN_IN) : t(I18N_KEYS.AUTH_CREATE_ACCOUNT);
    const helperCopy = mode === "login" ? t(I18N_KEYS.AUTH_TERMS) : t(I18N_KEYS.AUTH_VERIFY_LATER);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label htmlFor={`${mode}-email`} className="text-xs font-medium text-slate-500">
                    {t(I18N_KEYS.AUTH_EMAIL_LABEL)}
                </label>
                <input
                    id={`${mode}-email`}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                    autoComplete="email"
                />
            </div>
            <div className="space-y-1">
                <label htmlFor={`${mode}-password`} className="text-xs font-medium text-slate-500">
                    {t(I18N_KEYS.AUTH_PASSWORD_LABEL)}
                </label>
                <input
                    id={`${mode}-password`}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
            </div>
            {mode === "signup" && (
                <>
                    <div className="space-y-1">
                        <label htmlFor="signup-confirm" className="text-xs font-medium text-slate-500">
                            {t(I18N_KEYS.AUTH_CONFIRM_PASSWORD_LABEL)}
                        </label>
                        <input
                            id="signup-confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            required
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                            autoComplete="new-password"
                        />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            checked={sendVerifyEmail}
                            onChange={(event) => setSendVerifyEmail(event.target.checked)}
                        />
                        {t(I18N_KEYS.AUTH_SEND_VERIFICATION_EMAIL)}
                    </label>
                </>
            )}

            {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            )}

            <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-hidden />
                )}
                <span>{submitLabel}</span>
            </button>

            <p className="text-[11px] text-slate-500">{helperCopy}</p>
        </form>
    );
};

export default EmailPasswordForm;

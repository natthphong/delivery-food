import React from "react";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import type { Me } from "@/components/account/types";

type VerifyUpdateCardProps = {
    me: Me | null;
    newEmail: string;
    setNewEmail: (value: string) => void;
    onResendEmail: () => void;
    onChangeEmail: () => void;
    phone: string;
    setPhone: (value: string) => void;
    otp: string;
    setOtp: (value: string) => void;
    onSendOtp: () => void;
    onConfirmOtp: () => void;
    verifyingEmail: boolean;
    updatingEmail: boolean;
    sendingOtp: boolean;
    confirmingOtp: boolean;
};

const VerifyUpdateCard: React.FC<VerifyUpdateCardProps> = ({
    me,
    newEmail,
    setNewEmail,
    onResendEmail,
    onChangeEmail,
    phone,
    setPhone,
    otp,
    setOtp,
    onSendOtp,
    onConfirmOtp,
    verifyingEmail,
    updatingEmail,
    sendingOtp,
    confirmingOtp,
}) => {
    const { t } = useI18n();

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_VERIFY_UPDATE_TITLE)}</h3>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.ACCOUNT_EMAIL_VERIFICATION_TITLE)}</p>
                            <p className="text-xs text-slate-500">{t(I18N_KEYS.ACCOUNT_EMAIL_VERIFICATION_DESCRIPTION)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onResendEmail}
                            disabled={verifyingEmail || !me?.email}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {verifyingEmail ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.ACCOUNT_VERIFY_EMAIL_ACTION)}
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.ACCOUNT_CHANGE_EMAIL_TITLE)}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="email"
                            placeholder={t(I18N_KEYS.ACCOUNT_CHANGE_EMAIL_PLACEHOLDER)}
                            value={newEmail}
                            onChange={(event) => setNewEmail(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                        <button
                            type="button"
                            onClick={onChangeEmail}
                            disabled={updatingEmail || !newEmail.trim()}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {updatingEmail ? t(I18N_KEYS.COMMON_UPDATING) : t(I18N_KEYS.ACCOUNT_CHANGE_EMAIL_ACTION)}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">{t(I18N_KEYS.ACCOUNT_CHANGE_EMAIL_HINT)}</p>
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.ACCOUNT_PHONE_SECTION_TITLE)}</p>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <input
                            type="tel"
                            placeholder={t(I18N_KEYS.ACCOUNT_PHONE_PLACEHOLDER)}
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 lg:max-w-sm"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                                id="btn-send-otp"
                                type="button"
                                onClick={onSendOtp}
                                disabled={sendingOtp || !phone.trim()}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {sendingOtp ? t(I18N_KEYS.COMMON_SENDING) : t(I18N_KEYS.ACCOUNT_SEND_OTP)}
                            </button>
                            <input
                                type="text"
                                placeholder={t(I18N_KEYS.ACCOUNT_OTP_PLACEHOLDER)}
                                value={otp}
                                onChange={(event) => setOtp(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:w-28"
                            />
                            <button
                                type="button"
                                onClick={onConfirmOtp}
                                disabled={confirmingOtp || !otp.trim()}
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {confirmingOtp ? t(I18N_KEYS.COMMON_CONFIRMING) : t(I18N_KEYS.ACCOUNT_CONFIRM_OTP)}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">{t(I18N_KEYS.ACCOUNT_PHONE_HINT)}</p>
                </div>
            </div>
        </div>
    );
};

export default VerifyUpdateCard;

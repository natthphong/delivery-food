import React, { useMemo } from "react";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import type { Me } from "@/components/account/types";

type ProfileCardProps = {
    me: Me;
    loading: boolean;
    onLogout: () => void;
};

const Chip: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
        }`}
    >
        {label}
    </span>
);

const ProfileCard: React.FC<ProfileCardProps> = ({ me, loading, onLogout }) => {
    const { t } = useI18n();

    const providerLabel = useMemo(() => {
        if (!me?.provider) return "-";
        return me.provider;
    }, [me?.provider]);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_PROFILE_TITLE)}</h2>
                    <p className="text-xs text-slate-500">
                        {t(I18N_KEYS.ACCOUNT_PROVIDER_LABEL)}: <span className="font-mono text-slate-700">{providerLabel}</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                    {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                </button>
            </div>

            {loading ? (
                <p className="mt-4 text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>
            ) : (
                <div className="mt-4 space-y-4">
                    <div>
                        <div className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_EMAIL)}</div>
                        <div className="flex items-center gap-2">
                            <div className="font-medium text-slate-900">{me.email || "-"}</div>
                            <Chip
                                ok={me.is_email_verified}
                                label={t(me.is_email_verified ? I18N_KEYS.ACCOUNT_VERIFIED : I18N_KEYS.ACCOUNT_UNVERIFIED)}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_PHONE)}</div>
                        <div className="flex items-center gap-2">
                            <div className="font-medium text-slate-900">{me.phone || "-"}</div>
                            <Chip
                                ok={me.is_phone_verified}
                                label={t(me.is_phone_verified ? I18N_KEYS.ACCOUNT_VERIFIED : I18N_KEYS.ACCOUNT_UNVERIFIED)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileCard;

import React, { useCallback } from "react";
import { useRouter } from "next/router";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { type Locale, useI18n } from "@/utils/i18n";

type LocaleSwitcherProps = {
    className?: string;
};

const LocaleSwitcher: React.FC<LocaleSwitcherProps> = ({ className }) => {
    const router = useRouter();
    const { locale, setLocale, t } = useI18n();

    const handleChange = useCallback(
        (nextLocale: Locale) => {
            if (nextLocale === locale) return;
            setLocale(nextLocale);
            void router.replace(
                {
                    pathname: router.pathname,
                    query: { ...router.query, lang: nextLocale },
                },
                undefined,
                { shallow: true }
            );
        },
        [locale, router, setLocale]
    );

    return (
        <div className={`flex items-center gap-2 text-xs text-slate-600 ${className ?? ""}`}>
            <span className="font-medium">{t(I18N_KEYS.LOCALE_SWITCHER_LABEL)}</span>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-[11px] shadow-sm">
                <button
                    type="button"
                    onClick={() => handleChange("th")}
                    className={`rounded-full px-2 py-1 transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                        locale === "th"
                            ? "bg-emerald-600 text-white"
                            : "text-slate-600 hover:bg-emerald-50"
                    }`}
                >
                    {t(I18N_KEYS.LOCALE_THAI)}
                </button>
                <button
                    type="button"
                    onClick={() => handleChange("en")}
                    className={`rounded-full px-2 py-1 transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                        locale === "en"
                            ? "bg-emerald-600 text-white"
                            : "text-slate-600 hover:bg-emerald-50"
                    }`}
                >
                    {t(I18N_KEYS.LOCALE_ENGLISH)}
                </button>
            </div>
        </div>
    );
};

export default LocaleSwitcher;

import React from "react";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { type Locale, useI18n } from "@/utils/i18n";

const FloatingLanguageToggle: React.FC = () => {
    const { locale, setLocale, t } = useI18n();

    const handleChange = (nextLocale: Locale) => {
        if (nextLocale === locale) return;
        setLocale(nextLocale);
    };

    return (
        <div className="fixed bottom-4 left-4 z-50">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
                <span className="sr-only">{t(I18N_KEYS.LOCALE_SWITCHER_LABEL)}</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleChange("th")}
                        className={`min-w-[2.5rem] rounded-xl px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            locale === "th"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-white text-slate-600 hover:bg-emerald-50"
                        }`}
                        aria-pressed={locale === "th"}
                    >
                        TH
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange("en")}
                        className={`min-w-[2.5rem] rounded-xl px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            locale === "en"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "bg-white text-slate-600 hover:bg-emerald-50"
                        }`}
                        aria-pressed={locale === "en"}
                    >
                        EN
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FloatingLanguageToggle;


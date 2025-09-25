import type { Locale } from "@/utils/i18n";

export function formatInBangkok(iso?: string | null, locale: Locale = "en"): string {
    if (!iso) return "-";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) {
        return "-";
    }
    const resolvedLocale = locale === "th" ? "th-TH" : "en-US";
    return new Intl.DateTimeFormat(resolvedLocale, {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
        timeZone: "Asia/Bangkok",
    }).format(dt);
}

import { useI18n } from "@/utils/i18n";

export default function Preparing() {
    const { locale } = useI18n();
    const label = locale === "th" ? "กำลังทำอาหาร…" : "Preparing order…";

    return (
        <div className="flex items-center gap-3 text-emerald-700">
            <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold">{label}</span>
        </div>
    );
}

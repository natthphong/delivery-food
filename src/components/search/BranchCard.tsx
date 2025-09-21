import React, { useMemo } from "react";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import type { BranchItem } from "@/components/search/types";

type BranchCardProps = {
    branch: BranchItem;
    onView: (id: number) => void;
};
function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
    return (h || 0) * 60 + (m || 0);
}

function isOpenNowBySchedule(openHours: Record<string, [string, string][]> | null | undefined): boolean {
    if (!openHours) return true;

    const jsDay = new Date().getDay();
    const mapDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][jsDay];

    const slots = openHours[mapDay] || [];
    if (!Array.isArray(slots) || slots.length === 0) return false;

    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    // Support normal and overnight windows (e.g., 22:00–02:00)
    return slots.some(([start, end]) => {
        const s = hhmmToMinutes(start);
        const e = hhmmToMinutes(end);
        if (Number.isNaN(s) || Number.isNaN(e)) return false;
        if (s <= e) {
            // same-day window
            return minutesNow >= s && minutesNow <= e;
        }
        // overnight window (spans midnight)
        return minutesNow >= s || minutesNow <= e;
    });
}

const BranchCard: React.FC<BranchCardProps> = ({ branch, onView }) => {
    const { t } = useI18n();
    const isOpenComputed = useMemo(() => {
        if (branch.is_force_closed) return false;
        if (branch.open_hours && typeof branch.open_hours === "object") {
            return isOpenNowBySchedule(branch.open_hours);
        }
        return branch.is_open;
    }, [branch.is_force_closed, branch.open_hours, branch.is_open]);

    const badge = useMemo(() => {
        if (branch.is_force_closed) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED_MANUAL), className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (!branch.is_open || !isOpenNowBySchedule(branch.open_hours)){
            return { label: t(I18N_KEYS.BRANCH_CLOSED), className: "border-slate-200 bg-slate-100 text-slate-600" };
        }
        return { label: t(I18N_KEYS.BRANCH_OPEN), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }, [branch.is_force_closed, branch.is_open, t]);

    const distance = useMemo(() => {
        if (typeof branch.distance_km !== "number") return null;
        return `${branch.distance_km.toFixed(1)} km`;
    }, [branch.distance_km]);

    const samples = useMemo(() => (branch.products_sample ?? []).slice(0, 3), [branch.products_sample]);

    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {branch.image_url ? (
                        <img src={branch.image_url} alt={branch.name} className="h-40 w-full object-cover" />
                    ) : (
                        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                            {t(I18N_KEYS.COMMON_NO_IMAGE)}
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
                            {branch.address_line && <p className="text-sm text-slate-500">{branch.address_line}</p>}
                        </div>
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
                            {badge.label}
                        </div>
                    </div>
                    {distance && (
                        <p className="text-sm text-slate-500">
                            {t(I18N_KEYS.SEARCH_DISTANCE_PREFIX)}: {distance}
                        </p>
                    )}
                    {samples.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                            {samples.map((item) => {
                                const price = item.price_effective ?? item.price ?? null;
                                return (
                                    <span
                                        key={item.id}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1"
                                    >
                                        <span className="font-medium text-slate-700">{item.name}</span>
                                        <span className="text-xs text-slate-500">{formatTHB(price)}</span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-auto">
                        <button
                            type="button"
                            onClick={() => isOpenComputed && onView(branch.id)}
                            disabled={!isOpenComputed}
                            aria-disabled={!isOpenComputed}
                            title={!isOpenComputed ? t(I18N_KEYS.BRANCH_CLOSED) : undefined}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition
                         hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99]
                         disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {t(I18N_KEYS.BRANCH_VIEW_MENU)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchCard;

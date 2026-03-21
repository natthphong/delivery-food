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

function isOpenNowBySchedule(branch: BranchItem): boolean {
    if (!branch.openHours || branch.openHours.length === 0) return branch.isOpen;
    const jsDay = new Date().getDay();
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    return branch.openHours
        .filter((window) => window.dayOfWeek === jsDay)
        .some((window) => {
            const start = hhmmToMinutes(window.openTime);
            const end = hhmmToMinutes(window.closeTime);
            if (start <= end) {
                return minutesNow >= start && minutesNow <= end;
            }
            return minutesNow >= start || minutesNow <= end;
        });
}

const BranchCard: React.FC<BranchCardProps> = ({ branch, onView }) => {
    const { t } = useI18n();
    const isOpenComputed = useMemo(() => {
        if (branch.isForceClosed) return false;
        if (Array.isArray(branch.openHours) && branch.openHours.length > 0) {
            return isOpenNowBySchedule(branch);
        }
        return branch.isOpen;
    }, [branch]);
    const canOrder = isOpenComputed && branch.acceptingOrders;

    const badge = useMemo(() => {
        if (branch.isForceClosed) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED_MANUAL), className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (!branch.isOpen || !isOpenComputed || !branch.acceptingOrders) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED), className: "border-slate-200 bg-slate-100 text-slate-600" };
        }
        return { label: t(I18N_KEYS.BRANCH_OPEN), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    }, [branch.acceptingOrders, branch.isForceClosed, branch.isOpen, isOpenComputed, t]);

    const distance = useMemo(() => {
        if (typeof branch.distanceKm !== "number") return null;
        return `${branch.distanceKm.toFixed(1)} km`;
    }, [branch.distanceKm]);

    const samples = useMemo(() => (branch.productSample ?? []).slice(0, 3), [branch.productSample]);

    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {branch.imageUrl ? (
                        <img src={branch.imageUrl} alt={branch.name} className="h-40 w-full object-cover" />
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
                            {branch.addressLine && <p className="text-sm text-slate-500">{branch.addressLine}</p>}
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
                    <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                        {branch.supportsPickup ? (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                                {t(I18N_KEYS.BRANCH_PICKUP_READY)}
                            </span>
                        ) : null}
                        {branch.supportsRiderDelivery ? (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                {t(I18N_KEYS.BRANCH_RIDER_DELIVERY)} {branch.riderDeliveryFee ? formatTHB(branch.riderDeliveryFee) : ""}
                            </span>
                        ) : null}
                    </div>
                    {branch.operationalNote ? <p className="text-xs text-amber-700">{branch.operationalNote}</p> : null}
                    {samples.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                            {samples.map((item) => {
                                const price = item.price ?? null;
                                return (
                                    <span
                                        key={item.productId}
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
                            onClick={() => canOrder && onView(branch.id)}
                            disabled={!canOrder}
                            aria-disabled={!canOrder}
                            title={!canOrder ? t(I18N_KEYS.BRANCH_CLOSED) : undefined}
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

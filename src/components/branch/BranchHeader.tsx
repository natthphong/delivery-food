import React from "react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type BranchStatusBadge = { label: string; className: string } | null;

type Props = {
    name: string;
    address?: string | null;
    imageUrl?: string | null;
    status: BranchStatusBadge;
    description?: string | null;
    operationalNote?: string | null;
    supportsPickup?: boolean;
    supportsRiderDelivery?: boolean;
    riderDeliveryFee?: number;
};

const BranchHeader: React.FC<Props> = ({
    name,
    address,
    imageUrl,
    status,
    description,
    operationalNote,
    supportsPickup,
    supportsRiderDelivery,
    riderDeliveryFee,
}) => {
    const { t } = useI18n();

    return (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-hidden rounded-t-3xl border-b border-slate-200 bg-slate-100">
                {imageUrl ? (
                    <img src={imageUrl} alt={name} className="h-60 w-full object-cover" />
                ) : (
                    <div className="flex h-60 items-center justify-center text-sm text-slate-400">
                        {t(I18N_KEYS.COMMON_NO_IMAGE)}
                    </div>
                )}
            </div>
            <div className="space-y-6 p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
                        {address && <p className="text-sm text-slate-500">{address}</p>}
                        {description ? <p className="mt-3 max-w-2xl text-sm text-slate-600">{description}</p> : null}
                    </div>
                    {status && (
                        <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}
                        >
                            {status.label}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {supportsPickup ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {t(I18N_KEYS.BRANCH_PICKUP_READY)}
                        </span>
                    ) : null}
                    {supportsRiderDelivery ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {t(I18N_KEYS.BRANCH_RIDER_DELIVERY)}
                        </span>
                    ) : null}
                </div>
                {operationalNote ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {operationalNote}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default BranchHeader;

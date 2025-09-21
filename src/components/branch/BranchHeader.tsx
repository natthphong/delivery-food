import React from "react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type BranchStatusBadge = { label: string; className: string } | null;

type Props = {
    name: string;
    address?: string | null;
    imageUrl?: string | null;
    status: BranchStatusBadge;
};

const BranchHeader: React.FC<Props> = ({ name, address, imageUrl, status }) => {
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
                    </div>
                    {status && (
                        <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}
                        >
                            {status.label}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BranchHeader;

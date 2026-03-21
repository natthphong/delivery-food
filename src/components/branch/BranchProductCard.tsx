import React from "react";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type AddOn = { id: number; name: string; price: number };

export type BranchProduct = {
    productId: number;
    name: string;
    imageUrl?: string | null;
    price: number;
    basePrice?: number | null;
    inStock: boolean;
    stockQty: number | null;
    description?: string | null;
    addOns?: AddOn[];
    isRecommended?: boolean;
    isTemporarilyClosed?: boolean;
    availabilityNote?: string | null;
    reorderLevel?: number | null;
};

type Props = {
    product: BranchProduct;
    onClick: (productId: number) => void;
};

const BranchProductCard: React.FC<Props> = ({ product, onClick }) => {
    const { t } = useI18n();
    const price = product.price;
    const showStock = typeof product.stockQty === "number";
    const disabled = !product.inStock || product.isTemporarilyClosed;

    return (
        <button
            type="button"
            onClick={() => onClick(product.productId)}
            disabled={disabled}
            className="flex flex-col items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="h-40 w-full object-cover" />
                ) : (
                    <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                        {t(I18N_KEYS.COMMON_NO_IMAGE)}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                    {product.isRecommended ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Popular</span>
                    ) : null}
                </div>
                <p className="text-sm text-emerald-600">{formatTHB(price)}</p>
                {showStock && (
                    <p className="text-xs text-slate-500">
                        {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {product.stockQty}
                    </p>
                )}
                <p className="text-xs text-slate-500">
                    {product.isTemporarilyClosed
                        ? "Temporarily unavailable"
                        : product.inStock
                            ? t(I18N_KEYS.BRANCH_AVAILABLE_LABEL)
                            : t(I18N_KEYS.BRANCH_OUT_OF_STOCK)}
                </p>
                {product.availabilityNote ? <p className="text-xs text-amber-700">{product.availabilityNote}</p> : null}
            </div>
        </button>
    );
};

export default BranchProductCard;

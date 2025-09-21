import React from "react";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type AddOn = { id: number; name: string; price: number };

export type BranchProduct = {
    id: number;
    name: string;
    image_url?: string | null;
    price: number;
    price_effective?: number | null;
    in_stock: boolean;
    stock_qty: number | null;
    description?: string | null;
    addons?: AddOn[];
};

type Props = {
    product: BranchProduct;
    onClick: (productId: number) => void;
};

const BranchProductCard: React.FC<Props> = ({ product, onClick }) => {
    const { t } = useI18n();
    const price = product.price_effective ?? product.price;
    const showStock = typeof product.stock_qty === "number";

    return (
        <button
            type="button"
            onClick={() => onClick(product.id)}
            disabled={!product.in_stock}
            className="flex flex-col items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-40 w-full object-cover" />
                ) : (
                    <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                        {t(I18N_KEYS.COMMON_NO_IMAGE)}
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                <p className="text-sm text-emerald-600">{formatTHB(price)}</p>
                {showStock && (
                    <p className="text-xs text-slate-500">
                        {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {product.stock_qty}
                    </p>
                )}
                <p className="text-xs text-slate-500">
                    {product.in_stock ? t(I18N_KEYS.BRANCH_AVAILABLE_LABEL) : t(I18N_KEYS.BRANCH_OUT_OF_STOCK)}
                </p>
            </div>
        </button>
    );
};

export default BranchProductCard;

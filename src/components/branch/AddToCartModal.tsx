import React from "react";
import { Modal, QuantityInput } from "@/components/common";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { formatTHB } from "@/utils/currency";
import type { BranchProduct } from "./BranchProductCard";

type Props = {
    open: boolean;
    product: BranchProduct | null;
    selectedAddOns: Record<number, boolean>;
    onToggleAddon: (addonId: number) => void;
    quantity: number;
    maxQuantity: number;
    onQuantityChange: (quantity: number) => void;
    saving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

const AddToCartModal: React.FC<Props> = ({
    open,
    product,
    selectedAddOns,
    onToggleAddon,
    quantity,
    maxQuantity,
    onQuantityChange,
    saving,
    onCancel,
    onConfirm,
}) => {
    const { t } = useI18n();

    if (!product) {
        return null;
    }

    const availabilityKey = product.in_stock
        ? I18N_KEYS.BRANCH_IN_STOCK_TEXT
        : I18N_KEYS.BRANCH_CURRENTLY_UNAVAILABLE_TEXT;

    return (
        <Modal open={open} onClose={onCancel} title={product.name} size="lg" footer={null}>
            <div className="flex flex-col gap-4 md:flex-row">
                <div className="md:w-1/2">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-56 w-full object-cover" />
                        ) : (
                            <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                                {t(I18N_KEYS.COMMON_NO_IMAGE)}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-1 space-y-4">
                    <div>
                        <p className="text-lg font-semibold text-slate-900">{formatTHB(product.price_effective ?? product.price)}</p>
                        <p className="text-sm text-slate-500">{t(availabilityKey)}</p>
                        {product.stock_qty != null && (
                            <p className="text-xs text-slate-500">
                                {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {product.stock_qty}
                            </p>
                        )}
                    </div>

                    {product.description && <p className="text-sm text-slate-600">{product.description}</p>}

                    <div className="space-y-2">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-medium text-slate-700">{t(I18N_KEYS.BRANCH_QUANTITY_LABEL)}</span>
                            <QuantityInput value={quantity} min={1} max={maxQuantity} onChange={onQuantityChange} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-slate-700">{t(I18N_KEYS.BRANCH_ADDONS_TITLE)}</h3>
                        {product.addons && product.addons.length > 0 ? (
                            <div className="mt-2 space-y-2">
                                {product.addons.map((addon) => (
                                    <label
                                        key={addon.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                    >
                                        <span className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!selectedAddOns[addon.id]}
                                                onChange={() => onToggleAddon(addon.id)}
                                            />
                                            {addon.name}
                                        </span>
                                        <span className="text-slate-500">{formatTHB(addon.price)}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">{t(I18N_KEYS.BRANCH_NO_ADDONS)}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                        >
                            {t(I18N_KEYS.COMMON_CANCEL)}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={saving || !product.in_stock}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? t(I18N_KEYS.BRANCH_SAVING) : t(I18N_KEYS.BRANCH_ADD_TO_CART)}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AddToCartModal;

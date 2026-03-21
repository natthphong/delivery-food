import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { QuantityInput } from "@components/common";
import type { RootState } from "@store/index";
import { useAppDispatch } from "@store/index";
import { setCart } from "@store/cartSlice";
import { clearCartBranch, fetchCart, removeCartItem, updateCartItem } from "@/services/cart";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { notify } from "@/utils/notify";
import { parseApiError } from "@/utils/apiErrors";
import { saveCheckoutDraft } from "@/utils/checkoutDraft";

type CartDrawerProps = {
    open: boolean;
    onClose: () => void;
};

type CheckoutDraft = {
    branchId: number;
    itemIds: number[];
};

export { CHECKOUT_DRAFT_KEY } from "@/utils/checkoutDraft";

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { t } = useI18n();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const cart = useSelector((state: RootState) => state.cart.value);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [pendingItemId, setPendingItemId] = useState<number | null>(null);

    const syncCartFromServer = async () => {
        const nextCart = await fetchCart();
        dispatch(setCart(nextCart));
        setSelectedIds((current) => current.filter((id) => nextCart.groups.some((group) => group.items.some((item) => item.id === id))));
        notify(t(I18N_KEYS.CART_SYNCED), "info");
        return nextCart;
    };

    useEffect(() => {
        if (!open) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds([]);
    }, [open]);

    const allItems = useMemo(() => cart.groups.flatMap((group) => group.items), [cart.groups]);
    const totalSelected = useMemo(
        () => allItems.filter((item) => selectedIds.includes(item.id)).reduce((sum, item) => sum + item.lineTotal, 0),
        [allItems, selectedIds]
    );

    const handleQtyChange = async (itemId: number, quantity: number) => {
        try {
            setPendingItemId(itemId);
            const nextCart = await updateCartItem(itemId, quantity);
            dispatch(setCart(nextCart));
        } catch (error: any) {
            const message = parseApiError(error, t(I18N_KEYS.CART_UPDATE_ERROR)).message;
            if (typeof error?.response?.status === "number" && (error.response.status === 404 || error.response.status === 409)) {
                await syncCartFromServer().catch(() => undefined);
            }
            notify(message, "error");
        } finally {
            setPendingItemId(null);
        }
    };

    const handleRemove = async (itemId: number) => {
        try {
            setPendingItemId(itemId);
            const nextCart = await removeCartItem(itemId);
            dispatch(setCart(nextCart));
            setSelectedIds((current) => current.filter((id) => id !== itemId));
        } catch (error: any) {
            const message = parseApiError(error, t(I18N_KEYS.CART_UPDATE_ERROR)).message;
            if (typeof error?.response?.status === "number" && (error.response.status === 404 || error.response.status === 409)) {
                await syncCartFromServer().catch(() => undefined);
            }
            notify(message, "error");
        } finally {
            setPendingItemId(null);
        }
    };

    const handleClearBranch = async (branchId: number) => {
        try {
            setPendingItemId(-branchId);
            const nextCart = await clearCartBranch(branchId);
            dispatch(setCart(nextCart));
            setSelectedIds((current) => {
                const branchItemIds = new Set(
                    cart.groups.find((group) => group.branchId === branchId)?.items.map((item) => item.id) ?? []
                );
                return current.filter((id) => !branchItemIds.has(id));
            });
        } catch (error: any) {
            const message = parseApiError(error, t(I18N_KEYS.CART_UPDATE_ERROR)).message;
            if (typeof error?.response?.status === "number" && (error.response.status === 404 || error.response.status === 409)) {
                await syncCartFromServer().catch(() => undefined);
            }
            notify(message, "error");
        } finally {
            setPendingItemId(null);
        }
    };

    const handleCheckout = async () => {
        if (selectedIds.length === 0) {
            notify(t(I18N_KEYS.CART_SELECT_AT_LEAST_ONE), "warning");
            return;
        }
        const selectedItems = allItems.filter((item) => selectedIds.includes(item.id));
        const branchIds = Array.from(new Set(selectedItems.map((item) => item.branchId)));
        if (branchIds.length !== 1) {
            notify(t(I18N_KEYS.CART_SINGLE_BRANCH_WARNING), "warning");
            return;
        }

        const draft: CheckoutDraft = {
            branchId: branchIds[0],
            itemIds: selectedItems.map((item) => item.id),
        };
        saveCheckoutDraft(draft);
        onClose();
        await router.push("/checkout");
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <button
                type="button"
                className="absolute inset-0 bg-emerald-950/10 backdrop-blur-sm"
                onClick={onClose}
                aria-label={t(I18N_KEYS.CART_CLOSE_CART)}
            />
            <aside className="absolute bottom-0 right-0 flex h-[88vh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl md:top-0 md:h-full md:max-w-xl md:rounded-none md:rounded-l-[2rem]">
                <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
                    <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-200 md:hidden" />
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.CART_BASKET)}</h2>
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.CART_ITEMS_READY, { count: cart.totalQuantity })}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-50"
                        >
                            {t(I18N_KEYS.COMMON_CLOSE)}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                    {cart.groups.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                            <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.CHECKOUT_EMPTY_TITLE)}</p>
                            <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_EMPTY_SUBTITLE)}</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {cart.groups.map((group) => (
                                <section key={group.branchId} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {group.branchImage ? (
                                                <img src={group.branchImage} alt={group.branchName} className="h-14 w-14 rounded-2xl object-cover" />
                                            ) : (
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                                                    {group.branchName.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-900">{group.branchName}</h3>
                                                <p className="text-xs text-slate-500">{formatTHB(group.subTotal)}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleClearBranch(group.branchId)}
                                            disabled={pendingItemId === -group.branchId}
                                            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white"
                                        >
                                            {t(I18N_KEYS.CART_CLEAR_BRANCH)}
                                        </button>
                                    </div>

                                    <ul className="mt-4 space-y-3">
                                        {group.items.map((item) => {
                                            const checked = selectedIds.includes(item.id);
                                            const addOns = Array.isArray(item.addOns) ? item.addOns : [];
                                            return (
                                                <li key={item.id} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                                                    <div className="flex gap-3">
                                                        <label className="mt-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() =>
                                                                    setSelectedIds((current) =>
                                                                        checked ? current.filter((id) => id !== item.id) : [...current, item.id]
                                                                    )
                                                                }
                                                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                                                            />
                                                        </label>
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.productName} className="h-20 w-20 rounded-2xl object-cover" />
                                                        ) : (
                                                            <div className="h-20 w-20 rounded-2xl bg-slate-100" />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                                    {addOns.length > 0 ? (
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            {addOns.map((addOn) => addOn.name).join(", ")}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                                <p className="text-sm font-semibold text-emerald-600">{formatTHB(item.lineTotal)}</p>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                                                <QuantityInput
                                                                    value={item.quantity}
                                                                    min={1}
                                                                    max={item.stockQty ?? 10}
                                                                    onChange={(next) => void handleQtyChange(item.id, next)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleRemove(item.id)}
                                                                    disabled={pendingItemId === item.id}
                                                                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                                                                >
                                                                    {t(I18N_KEYS.CART_REMOVE)}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    )}
                </div>

                <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-4 pb-5 pt-4">
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-slate-900 shadow-sm">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{t(I18N_KEYS.CART_SELECTED_TOTAL)}</span>
                            <span className="text-lg font-semibold text-slate-950">{formatTHB(totalSelected)}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleCheckout()}
                            disabled={selectedIds.length === 0}
                            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t(I18N_KEYS.CART_PROCEED_CHECKOUT)}
                        </button>
                    </div>
                </footer>
            </aside>
        </div>
    );
}

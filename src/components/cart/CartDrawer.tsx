import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import axios, { type ApiResponse } from "@utils/apiClient";
import { QuantityInput } from "@components/common";
import { buildCartItemKey } from "@utils/cart";
import { formatTHB } from "@utils/currency";
import type { CartBranchGroup, CartItem, UserRecord } from "@/types";
import type { RootState } from "@store/index";
import { useAppDispatch } from "@store/index";
import { setUser } from "@store/authSlice";
import { saveUser } from "@utils/tokenStorage";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

type CartDrawerProps = {
    open: boolean;
    onClose: () => void;
};

const ITEM_MAX = 10;
const CHECKOUT_DRAFT_KEY = "CHECKOUT_DRAFT";

type MessageState = string | null;

function cloneCard(card: CartBranchGroup[]): CartBranchGroup[] {
    return card.map((branch) => ({
        ...branch,
        productList: branch.productList.map((item) => ({
            ...item,
            productAddOns: item.productAddOns.map((addon) => ({ ...addon })),
        })),
    }));
}

function filterEmpty(card: CartBranchGroup[]): CartBranchGroup[] {
    return card
        .map((branch) => ({
            ...branch,
            productList: branch.productList.filter((item) => item.qty > 0),
        }))
        .filter((branch) => branch.productList.length > 0);
}

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
    const { t } = useI18n();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const user = useSelector((state: RootState) => state.auth.user);
    const [optimisticCard, setOptimisticCard] = useState<CartBranchGroup[]>([]);
    const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<MessageState>(null);

    const allKeys = useMemo(
        () =>
            optimisticCard.flatMap((branch) =>
                branch.productList.map((item) => buildCartItemKey(branch.branchId, item))
            ),
        [optimisticCard]
    );

    const selectedCount = useMemo(() => allKeys.filter((key) => selectedMap[key]).length, [allKeys, selectedMap]);
    const allSelected = allKeys.length > 0 && allKeys.every((key) => selectedMap[key]);

    useEffect(() => {
        if (!open) {
            setSelectedMap({});
            return;
        }
        const nextCard = user?.card ?? [];
        setOptimisticCard(nextCard);
        setSelectedMap((prev) => {
            const allowed = new Set(
                nextCard.flatMap((branch) => branch.productList.map((item) => buildCartItemKey(branch.branchId, item)))
            );
            const nextSelected: Record<string, boolean> = {};
            allowed.forEach((key) => {
                if (prev[key]) {
                    nextSelected[key] = true;
                }
            });
            return nextSelected;
        });
    }, [open, user?.card]);

    const persistCard = useCallback(
        async (nextCard: CartBranchGroup[], prevCard: CartBranchGroup[]) => {
            setPending(true);
            try {
                if (!user) {
                    setOptimisticCard(prevCard);
                    return;
                }

                const response = await axios.post<ApiResponse<{ user: UserRecord }>>("/api/card/save", {
                    card: nextCard,
                    replace: true,
                });
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || t(I18N_KEYS.CART_UPDATE_ERROR));
                }
                const updatedUser = response.data.body?.user;
                if (!updatedUser) {
                    throw new Error(t(I18N_KEYS.CART_UPDATE_ERROR));
                }
                dispatch(setUser(updatedUser));
                saveUser(updatedUser);
                setError(null);
            } catch (err: any) {
                const message = err?.response?.data?.message || err?.message || t(I18N_KEYS.CART_UPDATE_ERROR);
                setError(message);
                setOptimisticCard(prevCard);
            } finally {
                setPending(false);
            }
        },
        [dispatch, user, t]
    );

    const handleToggleSelectAll = () => {
        setError(null);
        if (allSelected) {
            setSelectedMap({});
            return;
        }
        const next: Record<string, boolean> = {};
        allKeys.forEach((key) => {
            next[key] = true;
        });
        setSelectedMap(next);
    };

    const handleToggleItem = (key: string) => {
        setError(null);
        setSelectedMap((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleQtyChange = (branchId: string, itemKey: string, nextQty: number) => {
        if (pending) return;
        setError(null);
        const prevCard = cloneCard(optimisticCard);
        const updated = optimisticCard.map((branch) => {
            if (branch.branchId !== branchId) return branch;
            return {
                ...branch,
                productList: branch.productList.map((item) => {
                    const key = buildCartItemKey(branch.branchId, item);
                    if (key !== itemKey) return item;
                    const clamped = Math.max(1, Math.min(nextQty, ITEM_MAX));
                    if (clamped === item.qty) return item;
                    return { ...item, qty: clamped };
                }),
            };
        });
        setOptimisticCard(updated);
        void persistCard(filterEmpty(updated), prevCard);
    };

    const handleRemoveItem = (branchId: string, itemKey: string) => {
        if (pending) return;
        setError(null);
        const prevCard = cloneCard(optimisticCard);
        const updated = optimisticCard
            .map((branch) => {
                if (branch.branchId !== branchId) return branch;
                const filtered = branch.productList.filter(
                    (item) => buildCartItemKey(branch.branchId, item) !== itemKey
                );
                return { ...branch, productList: filtered };
            })
            .filter((branch) => branch.productList.length > 0);
        setOptimisticCard(updated);
        setSelectedMap((prev) => {
            const next = { ...prev };
            delete next[itemKey];
            return next;
        });
        void persistCard(updated, prevCard);
    };

    const handleRemoveSelected = () => {
        if (pending || selectedCount === 0) return;
        setError(null);
        const prevCard = cloneCard(optimisticCard);
        const updated = optimisticCard
            .map((branch) => {
                const filtered = branch.productList.filter(
                    (item) => !selectedMap[buildCartItemKey(branch.branchId, item)]
                );
                return { ...branch, productList: filtered };
            })
            .filter((branch) => branch.productList.length > 0);
        setOptimisticCard(updated);
        setSelectedMap({});
        void persistCard(updated, prevCard);
    };

    const handleCheckoutSelected = async () => {
        if (pending) return;
        const draft = optimisticCard
            .map((branch) => ({
                ...branch,
                productList: branch.productList.filter((item) =>
                    selectedMap[buildCartItemKey(branch.branchId, item)]
                ),
            }))
            .filter((branch) => branch.productList.length > 0);

        if (draft.length === 0) {
            setError(t(I18N_KEYS.CART_SELECT_AT_LEAST_ONE));
            return;
        }

        if (typeof window !== "undefined") {
            window.localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
        }
        onClose();
        await router.push("/checkout");
    };

    if (!open) return null;

    const addonPrefix = t(I18N_KEYS.CART_ADDON_PREFIX);
    const branchNumberPrefix = t(I18N_KEYS.CART_BRANCH_NUMBER_PREFIX);

    const renderAddOns = (item: CartItem) => {
        if (!item.productAddOns.length) return null;
        const formatted = item.productAddOns
            .map((addon) => `${addonPrefix} ${addon.name} ${formatTHB(addon.price)}`)
            .join(", ");
        return <p className="mt-1 text-xs text-slate-500">{formatted}</p>;
    };

    const renderBranch = (branch: CartBranchGroup) => (
        <div key={branch.branchId} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
                {branch.branchImage ? (
                    <img
                        src={branch.branchImage}
                        alt={branch.branchName}
                        className="h-12 w-12 rounded-xl object-cover"
                    />
                ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-700">
                        {branch.branchName.slice(0, 2).toUpperCase()}
                    </div>
                )}
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">{branch.branchName}</h3>
                    {branch.companyId && (
                        <p className="text-xs text-slate-500">{`${branchNumberPrefix}${branch.companyId}`}</p>
                    )}
                </div>
            </div>

            <ul className="mt-4 space-y-3">
                {branch.productList.map((item) => {
                    const key = buildCartItemKey(branch.branchId, item);
                    const base = item.price;
                    const addonsTotal = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
                    const itemTotal = (base + addonsTotal) * item.qty;
                    return (
                        <li
                            key={key}
                            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={!!selectedMap[key]}
                                    onChange={() => handleToggleItem(key)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                                />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                    {renderAddOns(item)}
                                    <p className="mt-2 text-sm font-semibold text-emerald-600">{formatTHB(itemTotal)}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                                <QuantityInput
                                    value={item.qty}
                                    min={1}
                                    max={ITEM_MAX}
                                    onChange={(next) => handleQtyChange(branch.branchId, key, next)}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(branch.branchId, key)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                >
                                    <svg
                                        aria-hidden="true"
                                        className="h-4 w-4"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                    >
                                        <path d="M5 7h14" strokeLinecap="round" />
                                        <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" />
                                        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                                        <path d="M6 7l1 12a1 1 0 0 0 1 .92h8a1 1 0 0 0 1-.92L18 7" strokeLinecap="round" />
                                    </svg>
                                    {t(I18N_KEYS.CART_REMOVE)}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );

    const hasItems = optimisticCard.some((branch) => branch.productList.length > 0);

    return (
        <div className="fixed inset-0 z-50">
            <div
                className="absolute inset-0 bg-slate-900/40"
                role="presentation"
                onClick={onClose}
            />
            <div className="absolute inset-0 flex h-full flex-col justify-end sm:justify-start sm:items-end">
                <aside className="flex h-[88vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:h-full sm:max-w-md sm:rounded-none sm:border-l sm:border-slate-200">
                    <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.CART_DRAWER_TITLE)}</h2>
                            <p className="text-xs text-slate-500">{t(I18N_KEYS.CART_DRAWER_SUBTITLE)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={t(I18N_KEYS.CART_CLOSE_CART)}
                        >
                            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="m4 4 8 8M12 4 4 12" strokeLinecap="round" />
                            </svg>
                        </button>
                    </header>

                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        {!hasItems ? (
                            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                                <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.CART_EMPTY_TITLE)}</p>
                                <p className="mt-1 text-xs text-slate-500">{t(I18N_KEYS.CART_EMPTY_SUBTITLE)}</p>
                            </div>
                        ) : (
                            optimisticCard.map((branch) => renderBranch(branch))
                        )}
                    </div>

                    <footer className="border-t border-slate-200 bg-white px-5 py-4">
                        {error && (
                            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                {error}
                            </div>
                        )}
                        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                                    checked={allSelected && allKeys.length > 0}
                                    onChange={handleToggleSelectAll}
                                />
                                {t(I18N_KEYS.CART_SELECT_ALL)} ({selectedCount}/{allKeys.length})
                            </label>
                            {pending && <span className="text-emerald-600">{t(I18N_KEYS.COMMON_UPDATING)}</span>}
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={handleRemoveSelected}
                                disabled={selectedCount === 0 || pending}
                                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t(I18N_KEYS.CART_REMOVE_SELECTED)}
                            </button>
                            <button
                                type="button"
                                onClick={handleCheckoutSelected}
                                disabled={selectedCount === 0 || pending || !hasItems}
                                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t(I18N_KEYS.CART_CHECKOUT_SELECTED)}
                            </button>
                        </div>
                    </footer>
                </aside>
            </div>
        </div>
    );
}

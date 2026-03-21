import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import BranchHeader, { type BranchStatusBadge } from "@components/branch/BranchHeader";
import BranchMenuToolbar from "@components/branch/BranchMenuToolbar";
import BranchMenuGrid from "@components/branch/BranchMenuGrid";
import AddToCartModal from "@components/branch/AddToCartModal";
import { LoaderOverlay } from "@components/common";
import { useAppDispatch } from "@/store";
import { setCart } from "@/store/cartSlice";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { fetchBranchMenu, fetchTopMenu } from "@/services/branchMenu";
import { addCartItem } from "@/services/cart";
import { notify } from "@/utils/notify";
import type { BranchProduct } from "@/components/branch/BranchProductCard";
import type { BranchSummary } from "@/types";

type Product = BranchProduct;

const DEFAULT_PAGE_SIZE = 12;

function normalizeMenuItem(item: any): Product {
    return {
        productId: item.productId,
        name: item.name,
        imageUrl: item.imageUrl,
        price: item.price,
        basePrice: item.basePrice,
        inStock: item.inStock,
        stockQty: item.stockQty,
        description: item.description,
        addOns: (item.addOns ?? []).map((addOn: any) => ({
            id: addOn.id,
            name: addOn.name,
            price: addOn.price,
        })),
        isRecommended: item.isRecommended,
        isTemporarilyClosed: item.isTemporarilyClosed,
        availabilityNote: item.availabilityNote,
        reorderLevel: item.reorderLevel,
    };
}

const BranchPage: NextPage = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const branchIdParam = router.query.id;
    const branchId = Array.isArray(branchIdParam) ? branchIdParam[0] : branchIdParam;

    const tab: "all" | "top" = router.isReady && router.query.tab === "top" ? "top" : "all";
    const query = router.isReady && typeof router.query.q === "string" ? router.query.q : "";
    const page = router.isReady && typeof router.query.page === "string" ? Number(router.query.page) || 1 : 1;
    const size = router.isReady && typeof router.query.size === "string" ? Number(router.query.size) || DEFAULT_PAGE_SIZE : DEFAULT_PAGE_SIZE;

    const [branch, setBranch] = useState<BranchSummary | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState(query);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<Record<number, boolean>>({});
    const [quantity, setQuantity] = useState(1);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setSearchInput(query);
    }, [query]);

    const commitQuery = useCallback(
        (patch: Partial<{ tab: "all" | "top"; q: string; page: number; size: number }>) => {
            if (!branchId) return;
            const nextQuery = {
                id: String(branchId),
                ...((patch.tab ?? tab) === "top" ? { tab: "top" } : {}),
                ...((patch.q ?? searchInput).trim() ? { q: (patch.q ?? searchInput).trim() } : {}),
                ...(((patch.page ?? page) > 1 && (patch.tab ?? tab) === "all") ? { page: String(patch.page ?? page) } : {}),
                ...(((patch.size ?? size) !== DEFAULT_PAGE_SIZE && (patch.tab ?? tab) === "all") ? { size: String(patch.size ?? size) } : {}),
            };
            void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
        },
        [branchId, page, router, searchInput, size, tab]
    );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (searchInput !== query) {
                commitQuery({ q: searchInput, page: 1 });
            }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [commitQuery, query, searchInput]);

    useEffect(() => {
        if (!branchId) return;
        let ignore = false;
        setLoading(true);

        const run = async () => {
            try {
                const payload = tab === "top"
                    ? await fetchTopMenu(branchId)
                    : await fetchBranchMenu(branchId, { q: query, page, size });
                if (ignore) return;
                setBranch(payload.branch);
                setProducts((payload.menu ?? []).map(normalizeMenuItem));
                setTotal(payload.total ?? payload.menu.length);
                setError(null);
            } catch (err: any) {
                if (ignore) return;
                setError(err?.message || t(I18N_KEYS.BRANCH_LOAD_ERROR));
                setProducts([]);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        void run();
        return () => {
            ignore = true;
        };
    }, [branchId, page, query, size, tab, t]);

    const statusBadge: BranchStatusBadge = useMemo(() => {
        if (!branch) return null;
        if (branch.isForceClosed) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED_MANUAL), className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (!branch.acceptingOrders) {
            return { label: t(I18N_KEYS.BRANCH_ORDERS_PAUSED), className: "border-amber-200 bg-amber-50 text-amber-700" };
        }
        if (branch.isOpen) {
            return { label: t(I18N_KEYS.BRANCH_OPEN), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
        }
        return { label: t(I18N_KEYS.BRANCH_CLOSED), className: "border-slate-200 bg-slate-100 text-slate-600" };
    }, [branch, t]);

    const maxQuantity = useMemo(() => {
        if (!selectedProduct?.stockQty) return 10;
        return Math.max(selectedProduct.stockQty, 1);
    }, [selectedProduct?.stockQty]);

    const handleAddToCart = async () => {
        if (!branch || !selectedProduct) return;
        try {
            setSaving(true);
            const addOnIds = Object.entries(selectedAddOns)
                .filter(([, checked]) => checked)
                .map(([id]) => Number(id));
            const nextCart = await addCartItem({
                branchId: branch.id,
                productId: selectedProduct.productId,
                quantity,
                addOnIds,
            });
            dispatch(setCart(nextCart));
            notify(`${selectedProduct.name} ${t(I18N_KEYS.BRANCH_ADDED_SUFFIX)}`, "success");
            setSelectedProduct(null);
            setSelectedAddOns({});
            setQuantity(1);
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.BRANCH_SAVE_ERROR), "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                {branch ? (
                    <BranchHeader
                        name={branch.name}
                        address={branch.addressLine}
                        imageUrl={branch.imageUrl}
                        status={statusBadge}
                        description={branch.description}
                        operationalNote={branch.operationalNote}
                        supportsPickup={branch.supportsPickup}
                        supportsRiderDelivery={branch.supportsRiderDelivery}
                        riderDeliveryFee={branch.riderDeliveryFee}
                    />
                ) : null}

                <BranchMenuToolbar
                    searchBy={searchInput}
                    onSearchByChange={setSearchInput}
                    tab={tab}
                    onTabChange={(next) => commitQuery({ tab: next, page: 1 })}
                    page={page}
                    size={size}
                    total={tab === "all" ? total : undefined}
                    onPageChange={(next) => commitQuery({ page: next })}
                    onSizeChange={(next) => commitQuery({ size: next, page: 1 })}
                />

                {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                ) : null}

                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.BRANCH_MENU_TITLE)}</h2>
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.BRANCH_MENU_SUBTITLE)}</p>
                        </div>
                    </div>
                    {branch?.acceptingOrders === false ? (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {t(I18N_KEYS.BRANCH_ORDERS_PAUSED)}
                        </div>
                    ) : null}
                    <BranchMenuGrid products={products} onPick={(product) => {
                        setSelectedProduct(product);
                        setSelectedAddOns(
                            Object.fromEntries((product.addOns ?? []).map((addOn) => [addOn.id, false]))
                        );
                        setQuantity(1);
                    }} />
                    {!loading && products.length === 0 && !error ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                            {t(I18N_KEYS.BRANCH_EMPTY_MENU)}
                        </div>
                    ) : null}
                </section>
            </div>

            <AddToCartModal
                open={!!selectedProduct}
                product={selectedProduct}
                selectedAddOns={selectedAddOns}
                onToggleAddon={(addonId) => setSelectedAddOns((current) => ({ ...current, [addonId]: !current[addonId] }))}
                quantity={quantity}
                maxQuantity={maxQuantity}
                onQuantityChange={setQuantity}
                saving={saving}
                onCancel={() => {
                    setSelectedProduct(null);
                    setSelectedAddOns({});
                }}
                onConfirm={() => void handleAddToCart()}
            />

            <LoaderOverlay show={loading} label={t(I18N_KEYS.BRANCH_LOADING)} />
        </Layout>
    );
};

export default BranchPage;

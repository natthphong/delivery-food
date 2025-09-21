import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import BranchHeader, { type BranchStatusBadge } from "@components/branch/BranchHeader";
import BranchMenuToolbar from "@components/branch/BranchMenuToolbar";
import BranchMenuGrid from "@components/branch/BranchMenuGrid";
import AddToCartModal from "@components/branch/AddToCartModal";
import { LoaderOverlay } from "@components/common";
import axios, { type ApiResponse } from "@/utils/apiClient";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";
import { saveUser } from "@/utils/tokenStorage";
import type { UserRecord } from "@/types";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import type { I18nKey } from "@/constants/i18nKeys";
import { fetchBranchMenu, fetchTopMenu } from "@/services/branchMenu";
import { notify } from "@/utils/notify";
import type { BranchProduct } from "@/components/branch/BranchProductCard";

export type Product = BranchProduct;

export type BranchMenuBody = {
    branch: {
        id: number;
        company_id: number;
        name: string;
        image_url?: string | null;
        address_line?: string | null;
        is_open: boolean;
        is_force_closed: boolean;
        hours?: Array<{ day: string; open: string; close: string }>;
    };
    products: Product[];
};

type SelectedAddOns = Record<number, boolean>;

type ApiOpenHours = Record<
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | string,
    [string, string][]
>;

type ApiBranch = {
    id: number;
    company_id: number;
    name: string;
    description?: string | null;
    image_url?: string | null;
    address_line?: string | null;
    lat?: number | null;
    lng?: number | null;
    open_hours?: ApiOpenHours | null;
    is_force_closed: boolean;
};

type ApiMenuItem = {
    product_id: number;
    name: string;
    description?: string | null;
    image_url?: string | null;
    price: string;
    is_enabled: boolean;
    stock_qty: number | null;
    add_ons: Array<{
        id: number;
        name: string;
        price: number;
        is_required: boolean;
        group_name: string;
    }>;
};

type ApiBranchMenuResponse = {
    branch: ApiBranch;
    menu: ApiMenuItem[];
    page?: number;
    size?: number;
    total?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_QTY = 99;

const DAY_ORDER: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"> = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
];
const DAY_LABEL_KEYS: Record<string, I18nKey> = {
    mon: I18N_KEYS.BRANCH_DAY_MON,
    tue: I18N_KEYS.BRANCH_DAY_TUE,
    wed: I18N_KEYS.BRANCH_DAY_WED,
    thu: I18N_KEYS.BRANCH_DAY_THU,
    fri: I18N_KEYS.BRANCH_DAY_FRI,
    sat: I18N_KEYS.BRANCH_DAY_SAT,
    sun: I18N_KEYS.BRANCH_DAY_SUN,
};

function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
    return (h || 0) * 60 + (m || 0);
}

function computeIsOpenNow(openHours?: ApiOpenHours | null, isForceClosed?: boolean): boolean {
    if (isForceClosed) return false;
    if (!openHours) return true;

    const jsDay = new Date().getDay();
    const mapDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][jsDay];
    const slots = openHours[mapDay] || [];
    if (!slots.length) return false;

    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();

    return slots.some(([start, end]) => {
        const s = hhmmToMinutes(start);
        const e = hhmmToMinutes(end);
        if (Number.isNaN(s) || Number.isNaN(e)) return false;
        return minutesNow >= s && minutesNow <= e;
    });
}

function mapApiToInternal(data: ApiBranchMenuResponse): BranchMenuBody {
    const b = data?.branch as ApiBranch;
    if (!b) throw new Error("Missing branch in response");

    const hours: Array<{ day: string; open: string; close: string }> = [];
    if (b.open_hours) {
        for (const day of DAY_ORDER) {
            const slots = b.open_hours[day] || [];
            for (const [open, close] of slots) {
                hours.push({ day: DAY_LABEL_KEYS[day] || day, open, close });
            }
        }
    }

    const isOpen = computeIsOpenNow(b.open_hours, b.is_force_closed);

    const products: Product[] = (data.menu || []).map((m) => {
        const priceNum = parseFloat(m.price);
        const inStock = m.is_enabled && (m.stock_qty == null || m.stock_qty > 0);
        return {
            id: m.product_id,
            name: m.name,
            description: m.description ?? null,
            image_url: m.image_url ?? null,
            price: Number.isFinite(priceNum) ? priceNum : 0,
            price_effective: null,
            in_stock: inStock,
            stock_qty: typeof m.stock_qty === "number" ? m.stock_qty : null,
            addons: (m.add_ons || []).map((addon) => ({
                id: addon.id,
                name: addon.name,
                price: addon.price ?? 0,
            })),
        };
    });

    return {
        branch: {
            id: b.id,
            company_id: b.company_id,
            name: b.name,
            image_url: b.image_url ?? null,
            address_line: b.address_line ?? null,
            is_force_closed: !!b.is_force_closed,
            is_open: isOpen,
            hours: hours.length ? hours : undefined,
        },
        products,
    };
}

const BranchPage: NextPage = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const branchIdParam = router.query.id;
    const branchId = Array.isArray(branchIdParam) ? branchIdParam[0] : branchIdParam;

    const tab: "all" | "top" = router.isReady && router.query.tab === "top" ? "top" : "all";
    const searchTerm = router.isReady && typeof router.query.searchBy === "string" ? router.query.searchBy : "";
    const pageQuery = router.isReady && typeof router.query.page === "string" ? Number(router.query.page) : 1;
    const sizeQuery = router.isReady && typeof router.query.size === "string" ? Number(router.query.size) : DEFAULT_PAGE_SIZE;

    const page = Number.isFinite(pageQuery) && pageQuery > 0 ? pageQuery : 1;
    const size = Number.isFinite(sizeQuery) && sizeQuery > 0 ? sizeQuery : DEFAULT_PAGE_SIZE;

    const [branch, setBranch] = useState<BranchMenuBody["branch"] | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<SelectedAddOns>({});
    const [quantity, setQuantity] = useState(1);
    const [savingCard, setSavingCard] = useState(false);
    const [total, setTotal] = useState<number | null>(null);
    const [searchInput, setSearchInput] = useState("");

    useEffect(() => {
        if (!router.isReady) return;
        setSearchInput(searchTerm);
    }, [router.isReady, searchTerm]);

    const commitQuery = useCallback(
        (patch: Partial<{ tab: "all" | "top"; searchBy?: string; page?: number; size?: number }>) => {
            if (!router.isReady || !branchId) return;
            const nextTab = patch.tab ?? tab;
            const nextSearch = patch.searchBy !== undefined ? patch.searchBy : searchTerm;
            const nextPage = patch.page ?? page;
            const nextSize = patch.size ?? size;

            const query: Record<string, string> = { id: String(branchId) };
            if (nextTab !== "all") {
                query.tab = nextTab;
            }
            if (nextSearch) {
                query.searchBy = nextSearch;
            }
            if (nextTab === "all") {
                if (nextPage > 1) {
                    query.page = String(nextPage);
                }
                if (nextSize !== DEFAULT_PAGE_SIZE) {
                    query.size = String(nextSize);
                }
            }

            void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
        },
        [branchId, page, router, searchTerm, size, tab]
    );

    useEffect(() => {
        if (!router.isReady) return;
        if (searchInput === searchTerm) return;
        const timer = window.setTimeout(() => {
            commitQuery({ searchBy: searchInput, page: 1 });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [commitQuery, router.isReady, searchInput, searchTerm]);

    useEffect(() => {
        if (!router.isReady) return;
        if (tab !== "all") return;
        if (total == null) return;
        const totalPages = Math.max(1, Math.ceil(total / size));
        if (page > totalPages) {
            commitQuery({ page: totalPages });
        }
    }, [commitQuery, page, router.isReady, size, tab, total]);

    useEffect(() => {
        if (!router.isReady || !branchId) return;
        let cancelled = false;

        const fetchMenu = async () => {
            setLoading(true);
            setError(null);
            try {
                let payload: ApiBranchMenuResponse;
                if (tab === "top") {
                    const topData = await fetchTopMenu(branchId);
                    if (cancelled) return;
                    payload = topData as ApiBranchMenuResponse;
                    setTotal(null);
                } else {
                    const menuData = await fetchBranchMenu(branchId, {
                        searchBy: searchTerm || undefined,
                        page,
                        size,
                    });
                    if (cancelled) return;
                    payload = menuData as ApiBranchMenuResponse;
                    const resolvedTotal = typeof menuData.total === "number" ? menuData.total : menuData.menu?.length ?? 0;
                    setTotal(resolvedTotal);
                }

                const mapped = mapApiToInternal(payload);
                if (cancelled) return;
                setBranch(mapped.branch);
                setProducts(mapped.products);
            } catch (err: any) {
                if (cancelled) return;
                const fallback = t(I18N_KEYS.BRANCH_LOAD_ERROR);
                const responseMessage = err?.response?.data?.message ?? err?.message;
                const resolved = typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : fallback;
                setError(resolved);
                setProducts([]);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void fetchMenu();
        return () => {
            cancelled = true;
        };
    }, [branchId, page, router.isReady, searchTerm, size, tab, t]);

    useEffect(() => {
        if (!selectedProduct) return;
        const stock = selectedProduct.stock_qty;
        const max = typeof stock === "number" ? Math.max(stock, 1) : DEFAULT_MAX_QTY;
        setQuantity((prev) => Math.min(Math.max(prev, 1), max));
    }, [selectedProduct]);

    const statusBadge: BranchStatusBadge = useMemo(() => {
        if (!branch) return null;
        if (branch.is_force_closed) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED_MANUAL), className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (branch.is_open) {
            return { label: t(I18N_KEYS.BRANCH_OPEN), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
        }
        return { label: t(I18N_KEYS.BRANCH_CLOSED), className: "border-slate-200 bg-slate-100 text-slate-600" };
    }, [branch, t]);

    const handleProductClick = useCallback((product: Product) => {
        setSelectedProduct(product);
        const initial: SelectedAddOns = {};
        product.addons?.forEach((addon) => {
            initial[addon.id] = false;
        });
        setSelectedAddOns(initial);
        setQuantity(1);
    }, []);

    const closeModal = useCallback(() => {
        setSelectedProduct(null);
        setSelectedAddOns({});
        setQuantity(1);
    }, []);

    const toggleAddon = useCallback((addonId: number) => {
        setSelectedAddOns((prev) => ({ ...prev, [addonId]: !prev[addonId] }));
    }, []);

    const handleQuantityChange = useCallback(
        (next: number) => {
            const stock = selectedProduct?.stock_qty;
            const max = typeof stock === "number" ? Math.max(stock, 1) : DEFAULT_MAX_QTY;
            const clamped = Math.min(Math.max(next, 1), max);
            setQuantity(clamped);
        },
        [selectedProduct]
    );

    const handleTabChange = useCallback(
        (nextTab: "all" | "top") => {
            if (nextTab === tab) return;
            commitQuery({ tab: nextTab, page: 1 });
        },
        [commitQuery, tab]
    );

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
    }, []);

    const handlePageChange = useCallback(
        (nextPage: number) => {
            const limit = tab === "all" && total != null ? Math.max(1, Math.ceil(total / size)) : 1;
            const clamped = Math.min(Math.max(nextPage, 1), limit);
            commitQuery({ page: clamped });
        },
        [commitQuery, size, tab, total]
    );

    const handleSizeChange = useCallback(
        (nextSize: number) => {
            const normalized = Math.max(1, nextSize);
            commitQuery({ size: normalized, page: 1 });
        },
        [commitQuery]
    );

    const maxQuantity = useMemo(() => {
        const stock = selectedProduct?.stock_qty;
        return typeof stock === "number" ? Math.max(stock, 1) : DEFAULT_MAX_QTY;
    }, [selectedProduct?.stock_qty]);

    const handleAddToCard = useCallback(async () => {
        if (!branch || !selectedProduct) return;

        setSavingCard(true);
        try {
            const chosenAddOns = (selectedProduct.addons ?? [])
                .filter((addon) => selectedAddOns[addon.id])
                .map((addon) => ({ name: addon.name, price: addon.price }));

            const cardPayload = [
                {
                    branchId: String(branch.id),
                    companyId: String(branch.company_id),
                    branchName: branch.name,
                    branchImage: branch.image_url ?? null,
                    productList: [
                        {
                            productId: String(selectedProduct.id),
                            productName: selectedProduct.name,
                            productAddOns: chosenAddOns,
                            qty: quantity,
                            price: selectedProduct.price_effective ?? selectedProduct.price,
                        },
                    ],
                },
            ];

            const response = await axios.post<ApiResponse<{ user: UserRecord }>>("/api/card/save", { card: cardPayload });
            if (response.data.code !== "OK") {
                throw new Error(response.data.message || "Failed to save card");
            }
            const updatedUser = response.data.body?.user;
            if (updatedUser) {
                dispatch(setUser(updatedUser));
                saveUser(updatedUser);
            }

            notify(`${selectedProduct.name} ${t(I18N_KEYS.BRANCH_ADDED_SUFFIX)}`, "success");
            closeModal();
        } catch (err: any) {
            const code = err?.response?.data?.code;
            if (code === "CARD_LIMIT_EXCEEDED") {
                const message = t(I18N_KEYS.BRANCH_CARD_LIMIT_ERROR);
                notify(message, "warning");
            } else {
                const fallback = t(I18N_KEYS.BRANCH_SAVE_ERROR);
                const responseMessage = err?.response?.data?.message ?? err?.message;
                const resolved =
                    typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : fallback;
                notify(resolved, "error");
            }
        } finally {
            setSavingCard(false);
        }
    }, [branch, closeModal, dispatch, quantity, selectedAddOns, selectedProduct, t]);

    const toolbarTotal = tab === "all" ? total : undefined;

    return (
        <Layout>
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                {branch && (
                    <BranchHeader
                        name={branch.name}
                        address={branch.address_line}
                        imageUrl={branch.image_url}
                        status={statusBadge}
                    />
                )}

                <BranchMenuToolbar
                    searchBy={searchInput}
                    onSearchByChange={handleSearchChange}
                    tab={tab}
                    onTabChange={handleTabChange}
                    page={page}
                    size={size}
                    total={toolbarTotal}
                    onPageChange={handlePageChange}
                    onSizeChange={handleSizeChange}
                />

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                )}

                <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.BRANCH_MENU_TITLE)}</h2>
                    <BranchMenuGrid products={products} onPick={handleProductClick} />
                    {!loading && products.length === 0 && !error && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
                            {t(I18N_KEYS.BRANCH_EMPTY_MENU)}
                        </div>
                    )}
                </section>
            </div>

            <AddToCartModal
                open={!!selectedProduct}
                product={selectedProduct}
                selectedAddOns={selectedAddOns}
                onToggleAddon={toggleAddon}
                quantity={quantity}
                maxQuantity={maxQuantity}
                onQuantityChange={handleQuantityChange}
                saving={savingCard}
                onCancel={closeModal}
                onConfirm={handleAddToCard}
            />

            <LoaderOverlay show={loading} label={t(I18N_KEYS.BRANCH_LOADING)} />
        </Layout>
    );
};

export default BranchPage;

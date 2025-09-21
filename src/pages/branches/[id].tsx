import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { formatTHB } from "@utils/currency";
import { LoaderOverlay, Modal, QuantityInput } from "@components/common";
import { useAppDispatch } from "@store/index";
import { setUser } from "@store/authSlice";
import { saveUser } from "@utils/tokenStorage";
import type { UserRecord } from "@/types";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import type { I18nKey } from "@/constants/i18nKeys";

/** ---------- Internal UI types ---------- */
export type AddOn = { id: number; name: string; price: number };
export type Product = {
    id: number;
    name: string;
    image_url?: string | null;
    price: number;
    price_effective?: number | null;
    in_stock: boolean;
    stock_qty: number | null;
    addons?: AddOn[];
    description?: string | null;
};
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

/** ---------- API response types ---------- */
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
    price: string; // e.g. "60.00"
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
};

/** ---------- Helpers: mapping & open-state ---------- */
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

// Parse either shape: {branch,menu} OR {code,message,body:{branch,menu}}
function extractBranchMenuPayload(payload: any): ApiBranchMenuResponse {
    if (payload?.branch && payload?.menu) return payload as ApiBranchMenuResponse;
    const body = payload?.body ?? payload?.data?.body;
    if (body?.branch && body?.menu) return body as ApiBranchMenuResponse;
    throw new Error("Invalid branch menu response shape");
}

function hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10));
    return (h || 0) * 60 + (m || 0);
}

// naive "open now" using local time
function computeIsOpenNow(openHours?: ApiOpenHours | null, isForceClosed?: boolean): boolean {
    if (isForceClosed) return false;
    if (!openHours) return true; // if not provided, treat as open

    const jsDay = new Date().getDay(); // 0..Sun
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

    // Flatten open_hours to array for UI (may be empty)
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
            addons: (m.add_ons || []).map((a) => ({
                id: a.id,
                name: a.name,
                price: a.price ?? 0,
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

/** ---------- Page ---------- */
const BranchPage: NextPage = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { id } = router.query;
    const { t } = useI18n();

    const [branch, setBranch] = useState<BranchMenuBody["branch"] | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<SelectedAddOns>({});
    const [quantity, setQuantity] = useState(1);
    const [savingCard, setSavingCard] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedProduct) return;
        const stock = selectedProduct.stock_qty;
        const max = typeof stock === "number" ? Math.max(stock, 1) : 99;
        setQuantity((prev) => Math.min(Math.max(prev, 1), max));
    }, [selectedProduct]);

    useEffect(() => {
        if (!router.isReady || !id) return;
        let cancelled = false;

        const fetchMenu = async (branchId: string) => {
            setLoading(true);
            try {
                const res = await axios.get(`/api/branches/${branchId}/menu`);
                if (cancelled) return;

                const payload = extractBranchMenuPayload(res.data);
                const mapped = mapApiToInternal(payload);
                setBranch(mapped.branch);
                setProducts(mapped.products);
                setError(null);
            } catch (err: any) {
                if (cancelled) return;
                const fallback = t(I18N_KEYS.BRANCH_LOAD_ERROR);
                const responseMessage = err?.response?.data?.message;
                const resolved =
                    typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : fallback;
                setError(resolved);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchMenu(String(id));
        return () => {
            cancelled = true;
        };
    }, [id, router.isReady, t]);

    const statusBadge = useMemo(() => {
        if (!branch) return null;
        if (branch.is_force_closed) {
            return { label: t(I18N_KEYS.BRANCH_CLOSED_MANUAL), className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (branch.is_open) {
            return { label: t(I18N_KEYS.BRANCH_OPEN), className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
        }
        return { label: t(I18N_KEYS.BRANCH_CLOSED), className: "border-slate-200 bg-slate-100 text-slate-600" };
    }, [branch, t]);

    const effectivePrice = (product: Product) => product.price_effective ?? product.price;

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
        const initial: SelectedAddOns = {};
        product.addons?.forEach((addon) => {
            initial[addon.id] = false;
        });
        setSelectedAddOns(initial);
        setQuantity(1);
        setActionError(null);
        setActionMessage(null);
    };

    const toggleAddon = (addonId: number) => {
        setSelectedAddOns((prev) => ({ ...prev, [addonId]: !prev[addonId] }));
    };

    const handleAddToCard = async () => {
        if (!branch || !selectedProduct) return;

        setSavingCard(true);
        setActionError(null);
        setActionMessage(null);

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
                            price: effectivePrice(selectedProduct),
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
            setActionMessage(`${selectedProduct.name} ${t(I18N_KEYS.BRANCH_ADDED_SUFFIX)}`);
            setSelectedProduct(null);
            setSelectedAddOns({});
            setQuantity(1);
        } catch (err: any) {
            const code = err?.response?.data?.code;
            if (code === "CARD_LIMIT_EXCEEDED") {
                setActionError(t(I18N_KEYS.BRANCH_CARD_LIMIT_ERROR));
            } else {
                const fallback = t(I18N_KEYS.BRANCH_SAVE_ERROR);
                const responseMessage = err?.response?.data?.message;
                const resolved =
                    typeof responseMessage === "string" && responseMessage.length > 0 ? responseMessage : fallback;
                setActionError(resolved);
            }
        } finally {
            setSavingCard(false);
        }
    };

    // SAFE: If selectedProduct is null/undefined, use default 99.
    const computedMaxQty = (() => {
        const stock = selectedProduct?.stock_qty;
        return typeof stock === "number" ? Math.max(stock, 1) : 99;
    })();

    const modalFooter = selectedProduct ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600">{t(I18N_KEYS.BRANCH_QUANTITY_LABEL)}</span>
                <QuantityInput value={quantity} min={1} max={computedMaxQty} onChange={setQuantity} />
                {selectedProduct.stock_qty != null && (
                    <span className="text-xs text-slate-500">
                        {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {selectedProduct.stock_qty}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                    {t(I18N_KEYS.COMMON_CANCEL)}
                </button>
                <button
                    type="button"
                    onClick={handleAddToCard}
                    disabled={savingCard || !selectedProduct.in_stock}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {savingCard ? t(I18N_KEYS.BRANCH_SAVING) : t(I18N_KEYS.BRANCH_ADD_TO_CARD)}
                </button>
            </div>
        </div>
    ) : undefined;

    return (
        <Layout>
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                {branch && (
                    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-hidden rounded-t-3xl border-b border-slate-200 bg-slate-100">
                            {branch.image_url ? (
                                <img src={branch.image_url} alt={branch.name} className="h-60 w-full object-cover" />
                            ) : (
                                <div className="flex h-60 items-center justify-center text-sm text-slate-400">
                                    {t(I18N_KEYS.COMMON_NO_IMAGE)}
                                </div>
                            )}
                        </div>
                        <div className="space-y-6 p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold text-slate-900">{branch.name}</h1>
                                    {branch.address_line && <p className="text-sm text-slate-500">{branch.address_line}</p>}
                                </div>
                                {statusBadge && (
                                    <span
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusBadge.className}`}
                                    >
                    {statusBadge.label}
                  </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {actionMessage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {actionMessage}
                    </div>
                )}
                {actionError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</div>
                )}

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                )}

                <section>
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">{t(I18N_KEYS.BRANCH_MENU_TITLE)}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {products.map((product) => {
                            const price = effectivePrice(product);
                            return (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => handleProductClick(product)}
                                    disabled={!product.in_stock}
                                    className="flex flex-col items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
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
                                        {typeof product.stock_qty === "number" && (
                                            <p className="text-xs text-slate-500">
                                                {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {product.stock_qty}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500">
                                            {product.in_stock
                                                ? t(I18N_KEYS.BRANCH_AVAILABLE_LABEL)
                                                : t(I18N_KEYS.BRANCH_OUT_OF_STOCK)}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {!loading && products.length === 0 && !error && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
                            {t(I18N_KEYS.BRANCH_NO_PRODUCTS)}
                        </div>
                    )}
                </section>
            </div>

            {selectedProduct && (
                <Modal
                    open={!!selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    title={selectedProduct.name}
                    size="lg"
                    footer={modalFooter}
                >
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div className="md:w-1/2">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                {selectedProduct.image_url ? (
                                    <img
                                        src={selectedProduct.image_url}
                                        alt={selectedProduct.name}
                                        className="h-56 w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                                        {t(I18N_KEYS.COMMON_NO_IMAGE)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">
                                    {formatTHB(effectivePrice(selectedProduct))}
                                </p>
                                <p className="text-sm text-slate-500">
                                    {selectedProduct.in_stock
                                        ? t(I18N_KEYS.BRANCH_IN_STOCK_TEXT)
                                        : t(I18N_KEYS.BRANCH_CURRENTLY_UNAVAILABLE_TEXT)}
                                </p>
                                {selectedProduct.stock_qty != null && (
                                    <p className="text-xs text-slate-500">
                                        {t(I18N_KEYS.BRANCH_STOCK_PREFIX)}: {selectedProduct.stock_qty}
                                    </p>
                                )}
                            </div>

                            {selectedProduct.description && (
                                <p className="text-sm text-slate-600">{selectedProduct.description}</p>
                            )}

                            <div>
                                <h3 className="text-sm font-semibold text-slate-700">{t(I18N_KEYS.BRANCH_ADDONS_TITLE)}</h3>
                                {selectedProduct.addons && selectedProduct.addons.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {selectedProduct.addons.map((addon) => (
                                            <label
                                                key={addon.id}
                                                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                                            >
                        <span className="flex items-center gap-3">
                          <input
                              type="checkbox"
                              checked={!!selectedAddOns[addon.id]}
                              onChange={() => toggleAddon(addon.id)}
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
                        </div>
                    </div>
                </Modal>
            )}

            <LoaderOverlay show={loading} label={t(I18N_KEYS.BRANCH_LOADING)} />
        </Layout>
    );
};

export default BranchPage;

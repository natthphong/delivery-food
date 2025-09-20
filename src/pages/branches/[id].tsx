import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import axios from "@utils/apiClient";
import { formatTHB } from "@utils/currency";
import { LoaderOverlay, Modal } from "@components/common";

/** ---------- Internal UI types ---------- */
export type AddOn = { id: number; name: string; price: number };
export type Product = {
    id: number;
    name: string;
    image_url?: string | null;
    price: number;
    price_effective?: number | null;
    in_stock: boolean;
    addons?: AddOn[];
    description?: string | null;
};
export type BranchMenuBody = {
    branch: {
        id: number;
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
const DAY_LABEL: Record<string, string> = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
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
                hours.push({ day: DAY_LABEL[day] || day, open, close });
            }
        }
    }

    const isOpen = computeIsOpenNow(b.open_hours, b.is_force_closed);

    const products: Product[] = (data.menu || []).map((m) => {
        const priceNum = parseFloat(m.price);
        const inStock = m.is_enabled && (m.stock_qty === null || m.stock_qty > 0);
        return {
            id: m.product_id,
            name: m.name,
            description: m.description ?? null,
            image_url: m.image_url ?? null,
            price: Number.isFinite(priceNum) ? priceNum : 0,
            price_effective: null,
            in_stock: inStock,
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
    const { id } = router.query;

    const [branch, setBranch] = useState<BranchMenuBody["branch"] | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<SelectedAddOns>({});

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
                const msg = err?.message || "Unable to load branch menu";
                setError(msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchMenu(String(id));
        return () => {
            cancelled = true;
        };
    }, [id, router.isReady]);

    const statusBadge = useMemo(() => {
        if (!branch) return null;
        if (branch.is_force_closed) {
            return { label: "Closed (manual)", className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (branch.is_open) {
            return { label: "Open", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
        }
        return { label: "Closed", className: "border-slate-200 bg-slate-100 text-slate-600" };
    }, [branch]);

    const effectivePrice = (product: Product) => product.price_effective ?? product.price;

    const handleProductClick = (product: Product) => {
        setSelectedProduct(product);
        const initial: SelectedAddOns = {};
        product.addons?.forEach((addon) => {
            initial[addon.id] = false;
        });
        setSelectedAddOns(initial);
    };

    const toggleAddon = (addonId: number) => {
        setSelectedAddOns((prev) => ({ ...prev, [addonId]: !prev[addonId] }));
    };

    // Group hours by day → [slots...], in Mon..Sun order, for a vertical list:
    const groupedHours = useMemo(() => {
        if (!branch?.hours || branch.hours.length === 0) return [];
        const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const map = new Map<string, Array<{ open: string; close: string }>>();
        for (const h of branch.hours) {
            if (!map.has(h.day)) map.set(h.day, []);
            map.get(h.day)!.push({ open: h.open, close: h.close });
        }
        return order
            .filter((d) => map.has(d))
            .map((d) => ({ day: d, slots: map.get(d)! }));
    }, [branch?.hours]);

    const modalFooter = (
        <div className="flex items-center justify-end gap-3">
            <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
                Close
            </button>
            <button
                type="button"
                disabled
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm opacity-60"
            >
                Add to cart
            </button>
        </div>
    );

    return (
        <Layout>
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                {branch && (
                    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-hidden rounded-t-3xl border-b border-slate-200 bg-slate-100">
                            {branch.image_url ? (
                                <img src={branch.image_url} alt={branch.name} className="h-60 w-full object-cover" />
                            ) : (
                                <div className="flex h-60 items-center justify-center text-sm text-slate-400">No image</div>
                            )}
                        </div>
                        <div className="space-y-6 p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold text-slate-900">{branch.name}</h1>
                                    {branch.address_line && <p className="text-sm text-slate-500">{branch.address_line}</p>}
                                </div>
                                {statusBadge && (
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                                )}
                            </div>

                            {/*/!* Opening hours (simple vertical list) *!/*/}
                            {/*{groupedHours.length > 0 && (*/}
                            {/*    <div>*/}
                            {/*        <p className="text-sm font-medium text-slate-700">Opening hours</p>*/}
                            {/*        <div className="mt-2 space-y-3">*/}
                            {/*            {groupedHours.map(({ day, slots }) => (*/}
                            {/*                <div key={day}>*/}
                            {/*                    <div className="text-sm font-medium text-slate-800">{day}</div>*/}
                            {/*                    {slots.map((s, i) => (*/}
                            {/*                        <div key={`${day}-${i}`} className="text-sm text-slate-600">*/}
                            {/*                            {s.open} - {s.close}*/}
                            {/*                        </div>*/}
                            {/*                    ))}*/}
                            {/*                </div>*/}
                            {/*            ))}*/}
                            {/*        </div>*/}
                            {/*    </div>*/}
                            {/*)}*/}
                        </div>
                    </div>
                )}

                {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

                <section>
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">Menu</h2>
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
                                            <div className="flex h-40 items-center justify-center text-xs text-slate-400">No image</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                                        <p className="text-sm text-emerald-600">{formatTHB(price)}</p>
                                        <p className="text-xs text-slate-500">{product.in_stock ? "Available" : "Out of stock"}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {!loading && products.length === 0 && !error && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">
                            No products found for this branch.
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
                                    <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-56 w-full object-cover" />
                                ) : (
                                    <div className="flex h-56 items-center justify-center text-sm text-slate-400">No image</div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <div>
                                <p className="text-lg font-semibold text-slate-900">{formatTHB(effectivePrice(selectedProduct))}</p>
                                <p className="text-sm text-slate-500">
                                    {selectedProduct.in_stock ? "In stock" : "Currently unavailable"}
                                </p>
                            </div>

                            {selectedProduct.description && (
                                <p className="text-sm text-slate-600">{selectedProduct.description}</p>
                            )}

                            <div>
                                <h3 className="text-sm font-semibold text-slate-700">Add-ons</h3>
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
                                    <p className="mt-2 text-sm text-slate-500">No add-ons available for this item.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            <LoaderOverlay show={loading} label="Loading menu" />
        </Layout>
    );
};

export default BranchPage;

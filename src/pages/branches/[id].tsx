import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import axios from "@utils/apiClient";
import { formatTHB } from "@utils/currency";
import { LoaderOverlay, Modal } from "@components/common";

export type AddOn = { id: number; name: string; price: number };
export type Product = {
    id: number;
    name: string;
    image_url?: string | null;
    price: number;
    price_effective?: number | null;
    in_stock: boolean;
    addons?: AddOn[];
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

type BranchMenuResponse = { code: string; message: string; body: BranchMenuBody };

type SelectedAddOns = Record<number, boolean>;

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
        const fetchMenu = async (branchId: string) => {
            setLoading(true);
            try {
                const response = await axios.get<BranchMenuResponse>(`/api/branches/${branchId}/menu`);
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || "Failed to load menu");
                }
                setBranch(response.data.body.branch);
                setProducts(response.data.body.products ?? []);
                setError(null);
            } catch (err: any) {
                const msg = err?.message || "Unable to load branch menu";
                setError(msg);
            } finally {
                setLoading(false);
            }
        };
        void fetchMenu(String(id));
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

    const effectivePrice = (product: Product) => {
        return product.price_effective ?? product.price;
    };

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
                        <div className="space-y-4 p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold text-slate-900">{branch.name}</h1>
                                    {branch.address_line && (
                                        <p className="text-sm text-slate-500">{branch.address_line}</p>
                                    )}
                                </div>
                                {statusBadge && (
                                    <span
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${statusBadge.className}`}
                                    >
                                        {statusBadge.label}
                                    </span>
                                )}
                            </div>
                            {branch.hours && branch.hours.length > 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-medium text-slate-600">Opening hours</p>
                                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                        {branch.hours.map((slot, index) => (
                                            <li key={`${slot.day}-${index}`} className="flex justify-between">
                                                <span className="font-medium text-slate-700">{slot.day}</span>
                                                <span>
                                                    {slot.open} - {slot.close}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                )}

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
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                className="h-40 w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-40 items-center justify-center text-xs text-slate-400">No image</div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                                        <p className="text-sm text-emerald-600">{formatTHB(price)}</p>
                                        <p className="text-xs text-slate-500">
                                            {product.in_stock ? "Available" : "Out of stock"}
                                        </p>
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
                                    <img
                                        src={selectedProduct.image_url}
                                        alt={selectedProduct.name}
                                        className="h-56 w-full object-cover"
                                    />
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

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminInputClass,
    adminSelectClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { statusTone } from "@/components/admin/formatters";
import {
    adjustBranchStock,
    fetchAdminBranches,
    fetchBranchProducts,
    updateAdminBranch,
    updateBranchProduct,
} from "@/services/admin";
import type { BranchSummary } from "@/types";
import type { AdminBranchProduct } from "@/types/admin";

export default function AdminBranchesPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const canRead = hasAnyAdminPermission(session, ["branches.read", "branches.manage", "stock.read", "stock.manage"]);
    const canManageBranch = hasAdminPermission(session, "branches.manage");
    const canManageStock = hasAdminPermission(session, "stock.manage");
    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [products, setProducts] = useState<AdminBranchProduct[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
    const [branchForm, setBranchForm] = useState({
        name: "",
        isForceClosed: false,
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: false,
        riderDeliveryFee: "0",
        operationalNote: "",
    });
    const [productForm, setProductForm] = useState({
        isEnabled: true,
        isTemporarilyClosed: false,
        stockQty: "",
        reorderLevel: "",
        availabilityNote: "",
    });
    const [stockForm, setStockForm] = useState({
        productId: "",
        deltaQty: "1",
        reason: "restock",
        note: "",
    });

    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === selectedBranchId) || null,
        [branches, selectedBranchId]
    );
    const selectedProduct = useMemo(
        () => products.find((product) => product.productId === selectedProductId) || null,
        [products, selectedProductId]
    );

    const reloadBranches = useCallback(async () => {
        const nextBranches = await fetchAdminBranches().catch(() => []);
        setBranches(nextBranches);
        if (!selectedBranchId && nextBranches[0]) {
            setSelectedBranchId(nextBranches[0].id);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        if (!canRead) return;
        void reloadBranches();
    }, [canRead, reloadBranches]);

    useEffect(() => {
        if (!selectedBranchId) {
            setProducts([]);
            return;
        }
        void fetchBranchProducts(selectedBranchId)
            .then(setProducts)
            .catch(() => setProducts([]));
    }, [selectedBranchId]);

    useEffect(() => {
        if (!selectedBranch) return;
        setBranchForm({
            name: selectedBranch.name,
            isForceClosed: selectedBranch.isForceClosed,
            acceptingOrders: selectedBranch.acceptingOrders,
            supportsPickup: selectedBranch.supportsPickup,
            supportsRiderDelivery: selectedBranch.supportsRiderDelivery,
            riderDeliveryFee: String(selectedBranch.riderDeliveryFee || 0),
            operationalNote: selectedBranch.operationalNote || "",
        });
    }, [selectedBranch]);

    useEffect(() => {
        if (!selectedProduct) return;
        setProductForm({
            isEnabled: selectedProduct.isEnabled,
            isTemporarilyClosed: selectedProduct.isTemporarilyClosed,
            stockQty: selectedProduct.stockQty != null ? String(selectedProduct.stockQty) : "",
            reorderLevel: selectedProduct.reorderLevel != null ? String(selectedProduct.reorderLevel) : "",
            availabilityNote: selectedProduct.availabilityNote || "",
        });
    }, [selectedProduct]);

    const handleSaveBranch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !canManageBranch) return;
        try {
            const updated = await updateAdminBranch(selectedBranchId, {
                name: branchForm.name,
                isForceClosed: branchForm.isForceClosed,
                acceptingOrders: branchForm.acceptingOrders,
                supportsPickup: branchForm.supportsPickup,
                supportsRiderDelivery: branchForm.supportsRiderDelivery,
                riderDeliveryFee: Number(branchForm.riderDeliveryFee) || 0,
                operationalNote: branchForm.operationalNote || null,
            });
            setBranches((current) => current.map((branch) => (branch.id === updated.id ? updated : branch)));
            notify("Branch operations updated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update branch settings.", "error");
        }
    };

    const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !selectedProductId || !canManageStock) return;
        try {
            const updatedProducts = await updateBranchProduct(selectedBranchId, selectedProductId, {
                isEnabled: productForm.isEnabled,
                isTemporarilyClosed: productForm.isTemporarilyClosed,
                stockQty: productForm.stockQty ? Number(productForm.stockQty) : null,
                reorderLevel: productForm.reorderLevel ? Number(productForm.reorderLevel) : null,
                availabilityNote: productForm.availabilityNote || null,
            });
            setProducts(updatedProducts);
            notify("Product operations updated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update product operations.", "error");
        }
    };

    const handleAdjustStock = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !canManageStock) return;
        try {
            const updatedProducts = await adjustBranchStock(selectedBranchId, {
                productId: Number(stockForm.productId),
                deltaQty: Number(stockForm.deltaQty),
                reason: stockForm.reason,
                note: stockForm.note,
            });
            setProducts(updatedProducts);
            notify("Stock movement recorded.", "success");
            setStockForm((current) => ({ ...current, deltaQty: "1", note: "" }));
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to adjust stock.", "error");
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader eyebrow="Branches and stock" title="Branches" description="This session does not have permission to access branch operations." />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow="Branch operations"
                    title="Store controls, product overrides, and inventory"
                    description="Branch-level availability is enforced customer-side and validated again on checkout. Use this screen to open/close stores, override products, and record stock changes."
                />

                <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                    <AdminSectionCard title="Branches" description="Select a branch to manage store-level operational state.">
                        <div className="space-y-3">
                            {branches.map((branch) => (
                                <button
                                    key={branch.id}
                                    type="button"
                                    onClick={() => setSelectedBranchId(branch.id)}
                                    className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                        selectedBranchId === branch.id
                                            ? "border-emerald-300 bg-emerald-50"
                                            : "border-slate-200 bg-white hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{branch.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">{branch.addressLine || branch.slug}</p>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(branch.acceptingOrders ? "open" : "closed")}`}>
                                            {branch.acceptingOrders ? "accepting orders" : "closed"}
                                        </span>
                                    </div>
                                    {branch.operationalNote ? <p className="mt-3 text-xs text-slate-500">{branch.operationalNote}</p> : null}
                                </button>
                            ))}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard title="Branch controls" description="These settings shape whether customers can order and whether branches expose rider delivery.">
                        {!selectedBranch ? (
                            <p className="text-sm text-slate-500">Select a branch to manage it.</p>
                        ) : (
                            <form className="space-y-4" onSubmit={handleSaveBranch}>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Branch name</span>
                                    <input value={branchForm.name} onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))} className={adminInputClass} />
                                </label>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                        <input type="checkbox" checked={branchForm.isForceClosed} onChange={(event) => setBranchForm((current) => ({ ...current, isForceClosed: event.target.checked }))} />
                                        <span className="text-sm font-medium text-slate-700">Force close branch</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                        <input type="checkbox" checked={branchForm.acceptingOrders} onChange={(event) => setBranchForm((current) => ({ ...current, acceptingOrders: event.target.checked }))} />
                                        <span className="text-sm font-medium text-slate-700">Accepting orders</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                        <input type="checkbox" checked={branchForm.supportsPickup} onChange={(event) => setBranchForm((current) => ({ ...current, supportsPickup: event.target.checked }))} />
                                        <span className="text-sm font-medium text-slate-700">Pickup enabled</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                        <input type="checkbox" checked={branchForm.supportsRiderDelivery} onChange={(event) => setBranchForm((current) => ({ ...current, supportsRiderDelivery: event.target.checked }))} />
                                        <span className="text-sm font-medium text-slate-700">Rider delivery enabled</span>
                                    </label>
                                </div>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rider delivery fee</span>
                                    <input value={branchForm.riderDeliveryFee} onChange={(event) => setBranchForm((current) => ({ ...current, riderDeliveryFee: event.target.value }))} className={adminInputClass} />
                                </label>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Operational note</span>
                                    <textarea value={branchForm.operationalNote} onChange={(event) => setBranchForm((current) => ({ ...current, operationalNote: event.target.value }))} rows={4} className={adminInputClass} />
                                </label>
                                <button type="submit" disabled={!canManageBranch} className={adminButtonPrimaryClass}>
                                    Save branch controls
                                </button>
                            </form>
                        )}
                    </AdminSectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                    <AdminSectionCard title="Branch product availability" description="Stock-aware product overrides stay local to the selected branch.">
                        {!selectedBranch ? (
                            <p className="text-sm text-slate-500">Select a branch to inspect product availability.</p>
                        ) : (
                            <div className="space-y-3">
                                {products.length === 0 ? (
                                    <p className="text-sm text-slate-500">No products found for this branch.</p>
                                ) : (
                                    products.map((product) => (
                                        <button
                                            key={product.productId}
                                            type="button"
                                            onClick={() => setSelectedProductId(product.productId)}
                                            className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                                                selectedProductId === product.productId
                                                    ? "border-emerald-300 bg-emerald-50"
                                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{formatTHB(product.price)}</p>
                                                </div>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(product.isEnabled && !product.isTemporarilyClosed ? "open" : "closed")}`}>
                                                    {product.isEnabled && !product.isTemporarilyClosed ? "sellable" : "hidden"}
                                                </span>
                                            </div>
                                            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                                                <p>Stock: {product.stockQty ?? "-"}</p>
                                                <p>Reorder level: {product.reorderLevel ?? "-"}</p>
                                                <p>Low stock: {product.isLowStock ? "yes" : "no"}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </AdminSectionCard>

                    <div className="space-y-6">
                        <AdminSectionCard title="Product override" description="Apply branch-only availability or stock changes to the selected menu item.">
                            {!selectedProduct ? (
                                <p className="text-sm text-slate-500">Select a product to edit branch-level availability.</p>
                            ) : (
                                <form className="space-y-4" onSubmit={handleSaveProduct}>
                                    <div className="rounded-[1.5rem] bg-slate-50 p-4">
                                        <p className="text-sm font-semibold text-slate-900">{selectedProduct.productName}</p>
                                        <p className="mt-1 text-sm text-slate-500">{formatTHB(selectedProduct.price)}</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={productForm.isEnabled} onChange={(event) => setProductForm((current) => ({ ...current, isEnabled: event.target.checked }))} />
                                            <span className="text-sm font-medium text-slate-700">Enabled on branch menu</span>
                                        </label>
                                        <label className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 px-4 py-3">
                                            <input type="checkbox" checked={productForm.isTemporarilyClosed} onChange={(event) => setProductForm((current) => ({ ...current, isTemporarilyClosed: event.target.checked }))} />
                                            <span className="text-sm font-medium text-slate-700">Temporarily closed</span>
                                        </label>
                                    </div>
                                    <label className="block space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Stock quantity</span>
                                        <input value={productForm.stockQty} onChange={(event) => setProductForm((current) => ({ ...current, stockQty: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="block space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reorder level</span>
                                        <input value={productForm.reorderLevel} onChange={(event) => setProductForm((current) => ({ ...current, reorderLevel: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="block space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Availability note</span>
                                        <textarea value={productForm.availabilityNote} onChange={(event) => setProductForm((current) => ({ ...current, availabilityNote: event.target.value }))} rows={4} className={adminInputClass} />
                                    </label>
                                    <button type="submit" disabled={!canManageStock} className={adminButtonPrimaryClass}>
                                        Save product override
                                    </button>
                                </form>
                            )}
                        </AdminSectionCard>

                        <AdminSectionCard title="Record stock movement" description="Use positive deltas for restocks and negative deltas for waste or shortages.">
                            <form className="space-y-4" onSubmit={handleAdjustStock}>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Product</span>
                                    <select value={stockForm.productId} onChange={(event) => setStockForm((current) => ({ ...current, productId: event.target.value }))} className={adminSelectClass}>
                                        <option value="">Select product</option>
                                        {products.map((product) => (
                                            <option key={product.productId} value={product.productId}>
                                                {product.productName}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Delta qty</span>
                                        <input value={stockForm.deltaQty} onChange={(event) => setStockForm((current) => ({ ...current, deltaQty: event.target.value }))} className={adminInputClass} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reason</span>
                                        <select value={stockForm.reason} onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value }))} className={adminSelectClass}>
                                            <option value="restock">Restock</option>
                                            <option value="sale_adjustment">Sale adjustment</option>
                                            <option value="waste">Waste</option>
                                            <option value="correction">Correction</option>
                                        </select>
                                    </label>
                                </div>
                                <label className="block space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Note</span>
                                    <input value={stockForm.note} onChange={(event) => setStockForm((current) => ({ ...current, note: event.target.value }))} className={adminInputClass} />
                                </label>
                                <button type="submit" disabled={!canManageStock} className={adminButtonSecondaryClass}>
                                    Record stock movement
                                </button>
                            </form>
                        </AdminSectionCard>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

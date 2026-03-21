import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionCard from "@/components/admin/AdminSectionCard";
import { useAdminText } from "@/components/admin/useAdminText";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";
import {
    adminButtonPrimaryClass,
    adminButtonSecondaryClass,
    adminFieldErrorClass,
    adminFieldHelperClass,
    adminFieldLabelClass,
    adminSurfaceMutedClass,
    getAdminFieldClass,
} from "@/components/admin/ui";
import { hasAnyAdminPermission, hasAdminPermission } from "@/components/admin/permissions";
import { useAppSelector } from "@/store";
import { statusTone } from "@/components/admin/formatters";
import {
    adjustBranchStock,
    createAdminBranch,
    fetchAdminBranches,
    fetchBranchProducts,
    updateAdminBranch,
    updateBranchProduct,
    updateBranchProductAddOn,
} from "@/services/admin";
import type { BranchSummary } from "@/types";
import type {
    AdminBranchProductAddOn,
    AdminBranchProduct,
    BranchCreateRequest,
    BranchProductAddOnOperationsUpdateRequest,
    BranchOperationsUpdateRequest,
    BranchProductOperationsUpdateRequest,
    StockAdjustmentRequest,
} from "@/types/admin";
import { parseApiError, type FieldErrors } from "@/utils/apiErrors";

type CreateBranchFormState = {
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    addressLine: string;
    lat: string;
    lng: string;
    isForceClosed: boolean;
    acceptingOrders: boolean;
    supportsPickup: boolean;
    supportsRiderDelivery: boolean;
    riderDeliveryFee: string;
    operationalNote: string;
    copyMode: "none" | "all" | "selected";
    copyFromBranchId: string;
    categoryIds: number[];
    productIds: number[];
};

type EditBranchFormState = {
    name: string;
    isForceClosed: boolean;
    acceptingOrders: boolean;
    supportsPickup: boolean;
    supportsRiderDelivery: boolean;
    riderDeliveryFee: string;
    operationalNote: string;
};

type ProductFormState = {
    isEnabled: boolean;
    isTemporarilyClosed: boolean;
    stockQty: string;
    reorderLevel: string;
    availabilityNote: string;
    priceMode: "base" | "override";
    priceOverride: string;
};

type AddOnFormState = {
    isEnabled: boolean;
    isTemporarilyClosed: boolean;
    availabilityNote: string;
    priceMode: "base" | "override";
    priceOverride: string;
};

type StockFormState = {
    productId: string;
    deltaQty: string;
    reason: string;
    note: string;
};

function emptyCreateBranchForm(): CreateBranchFormState {
    return {
        name: "",
        slug: "",
        description: "",
        imageUrl: "",
        addressLine: "",
        lat: "",
        lng: "",
        isForceClosed: false,
        acceptingOrders: true,
        supportsPickup: true,
        supportsRiderDelivery: true,
        riderDeliveryFee: "35",
        operationalNote: "",
        copyMode: "none",
        copyFromBranchId: "",
        categoryIds: [],
        productIds: [],
    };
}

function mapBranchToEditForm(branch: BranchSummary): EditBranchFormState {
    return {
        name: branch.name,
        isForceClosed: branch.isForceClosed,
        acceptingOrders: branch.acceptingOrders,
        supportsPickup: branch.supportsPickup,
        supportsRiderDelivery: branch.supportsRiderDelivery,
        riderDeliveryFee: String(branch.riderDeliveryFee || 0),
        operationalNote: branch.operationalNote || "",
    };
}

function mapProductToForm(product: AdminBranchProduct): ProductFormState {
    return {
        isEnabled: product.isEnabled,
        isTemporarilyClosed: product.isTemporarilyClosed,
        stockQty: product.stockQty != null ? String(product.stockQty) : "",
        reorderLevel: product.reorderLevel != null ? String(product.reorderLevel) : "",
        availabilityNote: product.availabilityNote || "",
        priceMode: product.priceOverride != null ? "override" : "base",
        priceOverride: product.priceOverride != null ? String(product.priceOverride) : String(product.price),
    };
}

function mapAddOnToForm(addOn: AdminBranchProductAddOn): AddOnFormState {
    return {
        isEnabled: addOn.isEnabled,
        isTemporarilyClosed: addOn.isTemporarilyClosed,
        availabilityNote: addOn.availabilityNote || "",
        priceMode: addOn.priceOverride != null ? "override" : "base",
        priceOverride: addOn.priceOverride != null ? String(addOn.priceOverride) : String(addOn.price),
    };
}

function parseOptionalNumber(value: string): number | null {
    if (!value.trim()) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isInvalidNumberInput(value: string) {
    return value.trim() !== "" && parseOptionalNumber(value) == null;
}

function Field({
    label,
    error,
    helper,
    children,
}: {
    label: string;
    error?: string;
    helper?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="space-y-2">
            <span className={adminFieldLabelClass}>{label}</span>
            {children}
            {error ? <p className={adminFieldErrorClass}>{error}</p> : helper ? <p className={adminFieldHelperClass}>{helper}</p> : null}
        </label>
    );
}

function statusLabel(product: AdminBranchProduct, tx: (key: string, params?: Record<string, string | number>) => string) {
    if (!product.isEnabled) {
        return tx("admin.branches.product.hidden");
    }
    if (product.isTemporarilyClosed) {
        return tx("admin.branches.product.paused");
    }
    return tx("admin.branches.product.sellable");
}

function addOnStatusLabel(addOn: AdminBranchProductAddOn, tx: (key: string, params?: Record<string, string | number>) => string) {
    if (!addOn.isEnabled) {
        return tx("admin.branches.addOn.hidden");
    }
    if (addOn.isTemporarilyClosed) {
        return tx("admin.branches.addOn.paused");
    }
    return tx("admin.branches.addOn.sellable");
}

function copyModeButtonClass(active: boolean) {
    return active
        ? "rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm"
        : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
}

export default function AdminBranchesPage() {
    const session = useAppSelector((state) => state.adminAuth.session);
    const tx = useAdminText();
    const canRead = hasAnyAdminPermission(session, ["branches.read", "branches.manage", "stock.read", "stock.manage"]);
    const canManageBranch = hasAdminPermission(session, "branches.manage");
    const canManageStock = hasAdminPermission(session, "stock.manage");
    const canCreateBranch =
        canManageBranch &&
        (session?.actorType === "bootstrap_admin" || session?.roles?.includes("owner") || session?.roles?.includes("manager"));

    const [branches, setBranches] = useState<BranchSummary[]>([]);
    const [products, setProducts] = useState<AdminBranchProduct[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [productSearch, setProductSearch] = useState("");
    const [productCategoryId, setProductCategoryId] = useState<number | "all">("all");
    const [branchLoading, setBranchLoading] = useState(false);
    const [productLoading, setProductLoading] = useState(false);
    const [listError, setListError] = useState("");

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState<CreateBranchFormState>(emptyCreateBranchForm);
    const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors>({});
    const [createSubmitError, setCreateSubmitError] = useState("");
    const [createSaving, setCreateSaving] = useState(false);
    const [sourceProducts, setSourceProducts] = useState<AdminBranchProduct[]>([]);
    const [sourceProductsLoading, setSourceProductsLoading] = useState(false);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<EditBranchFormState | null>(null);
    const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
    const [editSubmitError, setEditSubmitError] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    const [productModalProductId, setProductModalProductId] = useState<number | null>(null);
    const [productForm, setProductForm] = useState<ProductFormState | null>(null);
    const [productFieldErrors, setProductFieldErrors] = useState<FieldErrors>({});
    const [productSubmitError, setProductSubmitError] = useState("");
    const [productSaving, setProductSaving] = useState(false);
    const [addOnModalAddOnId, setAddOnModalAddOnId] = useState<number | null>(null);
    const [addOnForm, setAddOnForm] = useState<AddOnFormState | null>(null);
    const [addOnFieldErrors, setAddOnFieldErrors] = useState<FieldErrors>({});
    const [addOnSubmitError, setAddOnSubmitError] = useState("");
    const [addOnSaving, setAddOnSaving] = useState(false);

    const [stockModalOpen, setStockModalOpen] = useState(false);
    const [stockForm, setStockForm] = useState<StockFormState>({
        productId: "",
        deltaQty: "1",
        reason: "restock",
        note: "",
    });
    const [stockFieldErrors, setStockFieldErrors] = useState<FieldErrors>({});
    const [stockSubmitError, setStockSubmitError] = useState("");
    const [stockSaving, setStockSaving] = useState(false);

    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === selectedBranchId) || null,
        [branches, selectedBranchId]
    );

    const selectedProduct = useMemo(
        () => products.find((product) => product.productId === productModalProductId) || null,
        [productModalProductId, products]
    );

    const selectedAddOn = useMemo(
        () => selectedProduct?.addOns.find((addOn) => addOn.addOnId === addOnModalAddOnId) || null,
        [addOnModalAddOnId, selectedProduct]
    );

    const sourceCategories = useMemo(() => {
        const categoryMap = new Map<number, string>();
        sourceProducts.forEach((product) => {
            product.categories.forEach((category) => {
                categoryMap.set(category.id, category.name);
            });
        });
        return Array.from(categoryMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [sourceProducts]);

    const productCategories = useMemo(() => {
        const categoryMap = new Map<number, string>();
        products.forEach((product) => {
            product.categories.forEach((category) => categoryMap.set(category.id, category.name));
        });
        return Array.from(categoryMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [products]);

    const filteredProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase();
        if (!query) {
            return products.filter((product) =>
                productCategoryId === "all" ? true : product.categories.some((category) => category.id === productCategoryId)
            );
        }
        return products.filter((product) => {
            if (productCategoryId !== "all" && !product.categories.some((category) => category.id === productCategoryId)) {
                return false;
            }
            const haystack = `${product.productName} ${product.categories.map((category) => category.name).join(" ")}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [productCategoryId, productSearch, products]);

    const branchStats = useMemo(() => {
        return {
            sellableCount: products.filter((product) => product.isEnabled && !product.isTemporarilyClosed).length,
            hiddenCount: products.filter((product) => !product.isEnabled || product.isTemporarilyClosed).length,
            lowStockCount: products.filter((product) => product.isLowStock).length,
            addOnCount: products.reduce((total, product) => total + product.addOns.length, 0),
        };
    }, [products]);

    const reloadBranches = useCallback(async () => {
        if (!canRead) return [];
        setBranchLoading(true);
        setListError("");
        try {
            const nextBranches = await fetchAdminBranches();
            setBranches(nextBranches);
            setSelectedBranchId((current) => {
                if (current && nextBranches.some((branch) => branch.id === current)) {
                    return current;
                }
                return nextBranches[0]?.id ?? null;
            });
            return nextBranches;
        } catch (error: any) {
            setBranches([]);
            setSelectedBranchId(null);
            setListError(parseApiError(error, tx("admin.branches.loadError")).message);
            return [];
        } finally {
            setBranchLoading(false);
        }
    }, [canRead, tx]);

    const reloadProducts = useCallback(
        async (branchId: number) => {
            setProductLoading(true);
            try {
                const nextProducts = await fetchBranchProducts(branchId);
                setProducts(nextProducts);
            } catch (error: any) {
                setProducts([]);
                setListError(parseApiError(error, tx("admin.branches.productsLoadError")).message);
            } finally {
                setProductLoading(false);
            }
        },
        [tx]
    );

    useEffect(() => {
        void reloadBranches();
    }, [reloadBranches]);

    useEffect(() => {
        if (!selectedBranchId) {
            setProducts([]);
            return;
        }
        void reloadProducts(selectedBranchId);
    }, [reloadProducts, selectedBranchId]);

    useEffect(() => {
        setProductSearch("");
        setProductCategoryId("all");
        closeProductModal();
        closeStockModal();
    }, [selectedBranchId]);

    useEffect(() => {
        if (productCategoryId !== "all" && !productCategories.some((category) => category.id === productCategoryId)) {
            setProductCategoryId("all");
        }
    }, [productCategories, productCategoryId]);

    useEffect(() => {
        if (!createModalOpen || createForm.copyMode === "none" || !createForm.copyFromBranchId) {
            setSourceProducts([]);
            setSourceProductsLoading(false);
            return;
        }

        setSourceProductsLoading(true);
        void fetchBranchProducts(Number(createForm.copyFromBranchId))
            .then(setSourceProducts)
            .catch(() => setSourceProducts([]))
            .finally(() => setSourceProductsLoading(false));
    }, [createForm.copyFromBranchId, createForm.copyMode, createModalOpen]);

    const openCreateModal = () => {
        setCreateForm(emptyCreateBranchForm());
        setCreateFieldErrors({});
        setCreateSubmitError("");
        setSourceProducts([]);
        setCreateModalOpen(true);
    };

    const closeCreateModal = () => {
        setCreateModalOpen(false);
        setCreateFieldErrors({});
        setCreateSubmitError("");
        setCreateSaving(false);
    };

    const openEditModal = () => {
        if (!selectedBranch) return;
        setEditForm(mapBranchToEditForm(selectedBranch));
        setEditFieldErrors({});
        setEditSubmitError("");
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditFieldErrors({});
        setEditSubmitError("");
        setEditSaving(false);
    };

    const openProductModal = (product: AdminBranchProduct) => {
        closeAddOnModal();
        setProductModalProductId(product.productId);
        setProductForm(mapProductToForm(product));
        setProductFieldErrors({});
        setProductSubmitError("");
    };

    const closeProductModal = () => {
        setProductModalProductId(null);
        setProductForm(null);
        setProductFieldErrors({});
        setProductSubmitError("");
        setProductSaving(false);
        closeAddOnModal();
    };

    const openAddOnModal = (addOn: AdminBranchProductAddOn) => {
        setAddOnModalAddOnId(addOn.addOnId);
        setAddOnForm(mapAddOnToForm(addOn));
        setAddOnFieldErrors({});
        setAddOnSubmitError("");
    };

    const closeAddOnModal = () => {
        setAddOnModalAddOnId(null);
        setAddOnForm(null);
        setAddOnFieldErrors({});
        setAddOnSubmitError("");
        setAddOnSaving(false);
    };

    const openStockModal = (product?: AdminBranchProduct) => {
        setStockForm({
            productId: product ? String(product.productId) : "",
            deltaQty: "1",
            reason: "restock",
            note: "",
        });
        setStockFieldErrors({});
        setStockSubmitError("");
        setStockModalOpen(true);
    };

    const closeStockModal = () => {
        setStockModalOpen(false);
        setStockFieldErrors({});
        setStockSubmitError("");
        setStockSaving(false);
    };

    const toggleCreateCategory = (categoryId: number) => {
        setCreateForm((current) => ({
            ...current,
            categoryIds: current.categoryIds.includes(categoryId)
                ? current.categoryIds.filter((item) => item !== categoryId)
                : [...current.categoryIds, categoryId],
        }));
    };

    const toggleCreateProduct = (productId: number) => {
        setCreateForm((current) => ({
            ...current,
            productIds: current.productIds.includes(productId)
                ? current.productIds.filter((item) => item !== productId)
                : [...current.productIds, productId],
        }));
    };

    const handleCreateBranch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canCreateBranch) return;
        setCreateSaving(true);
        setCreateFieldErrors({});
        setCreateSubmitError("");
        try {
            const payload: BranchCreateRequest = {
                name: createForm.name.trim(),
                slug: createForm.slug.trim() || null,
                description: createForm.description.trim() || null,
                imageUrl: createForm.imageUrl.trim() || null,
                addressLine: createForm.addressLine.trim() || null,
                lat: parseOptionalNumber(createForm.lat),
                lng: parseOptionalNumber(createForm.lng),
                isForceClosed: createForm.isForceClosed,
                acceptingOrders: createForm.acceptingOrders,
                supportsPickup: createForm.supportsPickup,
                supportsRiderDelivery: createForm.supportsRiderDelivery,
                riderDeliveryFee: parseRequiredNumber(createForm.riderDeliveryFee),
                operationalNote: createForm.operationalNote.trim() || null,
                copyFromBranchId: createForm.copyFromBranchId ? Number(createForm.copyFromBranchId) : null,
                copyMode: createForm.copyMode,
                categoryIds: createForm.categoryIds,
                productIds: createForm.productIds,
            };
            const branch = await createAdminBranch(payload);
            notify(tx("admin.branches.createSuccess"), "success");
            await reloadBranches();
            setSelectedBranchId(branch.id);
            closeCreateModal();
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.branches.createError"));
            setCreateFieldErrors(parsed.fieldErrors);
            setCreateSubmitError(parsed.message);
        } finally {
            setCreateSaving(false);
        }
    };

    const handleSaveBranch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !canManageBranch || !editForm) return;
        setEditSaving(true);
        setEditFieldErrors({});
        setEditSubmitError("");
        try {
            const payload: BranchOperationsUpdateRequest = {
                name: editForm.name.trim(),
                isForceClosed: editForm.isForceClosed,
                acceptingOrders: editForm.acceptingOrders,
                supportsPickup: editForm.supportsPickup,
                supportsRiderDelivery: editForm.supportsRiderDelivery,
                riderDeliveryFee: parseRequiredNumber(editForm.riderDeliveryFee),
                operationalNote: editForm.operationalNote.trim() || null,
                clearOperationalNote: !editForm.operationalNote.trim(),
            };
            const branch = await updateAdminBranch(selectedBranchId, payload);
            setBranches((current) => current.map((item) => (item.id === branch.id ? branch : item)));
            notify(tx("admin.branches.saveSuccess"), "success");
            closeEditModal();
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.branches.saveError"));
            setEditFieldErrors(parsed.fieldErrors);
            setEditSubmitError(parsed.message);
        } finally {
            setEditSaving(false);
        }
    };

    const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !selectedProduct || !productForm || !canManageStock) return;
        const nextFieldErrors: FieldErrors = {};
        if (isInvalidNumberInput(productForm.stockQty)) {
            nextFieldErrors.stockQty = tx("admin.branches.validation.number");
        }
        if (isInvalidNumberInput(productForm.reorderLevel)) {
            nextFieldErrors.reorderLevel = tx("admin.branches.validation.number");
        }
        if (productForm.priceMode === "override" && parseOptionalNumber(productForm.priceOverride) == null) {
            nextFieldErrors.priceOverride = tx("admin.branches.validation.priceRequired");
        }
        if (Object.keys(nextFieldErrors).length > 0) {
            setProductFieldErrors(nextFieldErrors);
            setProductSubmitError(tx("admin.branches.validation.summary"));
            return;
        }
        setProductSaving(true);
        setProductFieldErrors({});
        setProductSubmitError("");
        try {
            const payload: BranchProductOperationsUpdateRequest = {
                isEnabled: productForm.isEnabled,
                isTemporarilyClosed: productForm.isTemporarilyClosed,
                stockQty: parseOptionalNumber(productForm.stockQty),
                reorderLevel: parseOptionalNumber(productForm.reorderLevel),
                availabilityNote: productForm.availabilityNote.trim() || null,
                clearAvailabilityNote: !productForm.availabilityNote.trim(),
                priceOverride: productForm.priceMode === "override" ? parseOptionalNumber(productForm.priceOverride) : null,
                clearPriceOverride: productForm.priceMode === "base",
            };
            const nextProducts = await updateBranchProduct(selectedBranchId, selectedProduct.productId, payload);
            setProducts(nextProducts);
            notify(tx("admin.branches.productSaveSuccess"), "success");
            closeProductModal();
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.branches.productSaveError"));
            setProductFieldErrors(parsed.fieldErrors);
            setProductSubmitError(parsed.message);
        } finally {
            setProductSaving(false);
        }
    };

    const handleSaveAddOn = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !selectedProduct || !selectedAddOn || !addOnForm || !canManageStock) return;
        const nextFieldErrors: FieldErrors = {};
        if (addOnForm.priceMode === "override" && parseOptionalNumber(addOnForm.priceOverride) == null) {
            nextFieldErrors.priceOverride = tx("admin.branches.validation.priceRequired");
        }
        if (Object.keys(nextFieldErrors).length > 0) {
            setAddOnFieldErrors(nextFieldErrors);
            setAddOnSubmitError(tx("admin.branches.validation.summary"));
            return;
        }
        setAddOnSaving(true);
        setAddOnFieldErrors({});
        setAddOnSubmitError("");
        try {
            const payload: BranchProductAddOnOperationsUpdateRequest = {
                isEnabled: addOnForm.isEnabled,
                isTemporarilyClosed: addOnForm.isTemporarilyClosed,
                availabilityNote: addOnForm.availabilityNote.trim() || null,
                clearAvailabilityNote: !addOnForm.availabilityNote.trim(),
                priceOverride: addOnForm.priceMode === "override" ? parseOptionalNumber(addOnForm.priceOverride) : null,
                clearPriceOverride: addOnForm.priceMode === "base",
            };
            const nextProducts = await updateBranchProductAddOn(selectedBranchId, selectedProduct.productId, selectedAddOn.addOnId, payload);
            setProducts(nextProducts);
            notify(tx("admin.branches.addOnSaveSuccess"), "success");
            closeAddOnModal();
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.branches.addOnSaveError"));
            setAddOnFieldErrors(parsed.fieldErrors);
            setAddOnSubmitError(parsed.message);
        } finally {
            setAddOnSaving(false);
        }
    };

    const handleAdjustStock = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedBranchId || !canManageStock) return;
        setStockSaving(true);
        setStockFieldErrors({});
        setStockSubmitError("");
        try {
            const payload: StockAdjustmentRequest = {
                productId: Number(stockForm.productId),
                deltaQty: Number(stockForm.deltaQty),
                reason: stockForm.reason,
                note: stockForm.note.trim(),
            };
            const nextProducts = await adjustBranchStock(selectedBranchId, payload);
            setProducts(nextProducts);
            notify(tx("admin.branches.stockSaveSuccess"), "success");
            closeStockModal();
        } catch (error: any) {
            const parsed = parseApiError(error, tx("admin.branches.stockSaveError"));
            setStockFieldErrors(parsed.fieldErrors);
            setStockSubmitError(parsed.message);
        } finally {
            setStockSaving(false);
        }
    };

    if (!canRead) {
        return (
            <AdminLayout>
                <AdminPageHeader
                    eyebrow={tx("admin.branches.pageEyebrow")}
                    title={tx("admin.branches.pageTitle")}
                    description={tx("admin.branches.noAccess")}
                />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <AdminPageHeader
                    eyebrow={tx("admin.branches.pageEyebrow")}
                    title={tx("admin.branches.pageTitle")}
                    description={tx("admin.branches.pageDescription")}
                    actions={
                        canCreateBranch ? (
                            <button type="button" onClick={openCreateModal} className={adminButtonPrimaryClass}>
                                {tx("admin.branches.newAction")}
                            </button>
                        ) : null
                    }
                />

                <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                    <AdminSectionCard
                        title={tx("admin.branches.listTitle")}
                        description={tx("admin.branches.listDescription")}
                        actions={
                            <button type="button" onClick={() => void reloadBranches()} className={adminButtonSecondaryClass}>
                                {tx("admin.branches.refreshAction")}
                            </button>
                        }
                    >
                        <div className="space-y-3">
                            {branchLoading ? <p className="text-sm text-slate-500">{tx("common.loading")}</p> : null}
                            {!branchLoading && listError ? <p className="text-sm font-medium text-rose-600">{listError}</p> : null}
                            {!branchLoading && !listError && branches.length === 0 ? (
                                <p className="text-sm text-slate-500">{tx("admin.branches.empty")}</p>
                            ) : null}
                            {!branchLoading && !listError
                                ? branches.map((branch) => (
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
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(branch.acceptingOrders && !branch.isForceClosed ? "open" : "closed")}`}>
                                                {branch.acceptingOrders && !branch.isForceClosed ? tx("admin.branches.branchOpen") : tx("admin.branches.branchClosed")}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                            <span className="rounded-full bg-white px-3 py-1">{branch.supportsPickup ? tx("admin.branches.pickupOn") : tx("admin.branches.pickupOff")}</span>
                                            <span className="rounded-full bg-white px-3 py-1">
                                                {branch.supportsRiderDelivery
                                                    ? tx("admin.branches.deliveryOn", { fee: formatTHB(branch.riderDeliveryFee || 0) })
                                                    : tx("admin.branches.deliveryOff")}
                                            </span>
                                        </div>
                                        {branch.operationalNote ? <p className="mt-3 text-xs text-slate-500">{branch.operationalNote}</p> : null}
                                    </button>
                                ))
                                : null}
                        </div>
                    </AdminSectionCard>

                    <AdminSectionCard
                        title={tx("admin.branches.overviewTitle")}
                        description={tx("admin.branches.overviewDescription")}
                        actions={
                            selectedBranch && canManageBranch ? (
                                <button type="button" onClick={openEditModal} className={adminButtonSecondaryClass}>
                                    {tx("admin.branches.editAction")}
                                </button>
                            ) : null
                        }
                    >
                        {!selectedBranch ? (
                            <p className="text-sm text-slate-500">{tx("admin.branches.selectPrompt")}</p>
                        ) : (
                            <div className="space-y-4">
                                <div className={adminSurfaceMutedClass}>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-lg font-semibold text-slate-950">{selectedBranch.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">{selectedBranch.addressLine || selectedBranch.slug}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedBranch.acceptingOrders && !selectedBranch.isForceClosed ? "open" : "closed")}`}>
                                                {selectedBranch.acceptingOrders && !selectedBranch.isForceClosed ? tx("admin.branches.branchOpen") : tx("admin.branches.branchClosed")}
                                            </span>
                                            {selectedBranch.isForceClosed ? (
                                                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                                                    {tx("admin.branches.forceClosed")}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-[1.25rem] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{tx("admin.branches.stat.sellable")}</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">{branchStats.sellableCount}</p>
                                        </div>
                                        <div className="rounded-[1.25rem] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{tx("admin.branches.stat.hidden")}</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">{branchStats.hiddenCount}</p>
                                        </div>
                                        <div className="rounded-[1.25rem] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{tx("admin.branches.stat.lowStock")}</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">{branchStats.lowStockCount}</p>
                                        </div>
                                        <div className="rounded-[1.25rem] bg-white p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{tx("admin.branches.stat.addOns")}</p>
                                            <p className="mt-2 text-2xl font-semibold text-slate-950">{branchStats.addOnCount}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                                        <p>{tx("admin.branches.pickupLabel")}: {selectedBranch.supportsPickup ? tx("admin.branches.enabled") : tx("admin.branches.disabled")}</p>
                                        <p>{tx("admin.branches.deliveryLabel")}: {selectedBranch.supportsRiderDelivery ? tx("admin.branches.enabled") : tx("admin.branches.disabled")}</p>
                                        <p>{tx("admin.branches.deliveryFeeLabel")}: {formatTHB(selectedBranch.riderDeliveryFee || 0)}</p>
                                        <p>{tx("admin.branches.slugLabel")}: {selectedBranch.slug}</p>
                                    </div>
                                    {selectedBranch.operationalNote ? (
                                        <p className="mt-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                                            {selectedBranch.operationalNote}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {canManageStock ? (
                                        <button type="button" onClick={() => openStockModal()} className={adminButtonPrimaryClass}>
                                            {tx("admin.branches.stockAction")}
                                        </button>
                                    ) : null}
                                    <button type="button" onClick={() => void reloadProducts(selectedBranch.id)} className={adminButtonSecondaryClass}>
                                        {tx("admin.branches.menuRefreshAction")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </AdminSectionCard>
                </div>

                <AdminSectionCard
                    title={tx("admin.branches.productsTitle")}
                    description={tx("admin.branches.productsDescription")}
                    actions={
                        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setProductCategoryId("all")}
                                    className={copyModeButtonClass(productCategoryId === "all")}
                                >
                                    {tx("admin.branches.filter.all")}
                                </button>
                                {productCategories.map((category) => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setProductCategoryId(category.id)}
                                        className={copyModeButtonClass(productCategoryId === category.id)}
                                    >
                                        {category.name}
                                    </button>
                                ))}
                            </div>
                            <div className="w-full xl:w-72">
                                <input
                                    value={productSearch}
                                    onChange={(event) => setProductSearch(event.target.value)}
                                    placeholder={tx("admin.branches.productSearchPlaceholder")}
                                    className={getAdminFieldClass()}
                                />
                            </div>
                        </div>
                    }
                >
                    {!selectedBranch ? (
                        <p className="text-sm text-slate-500">{tx("admin.branches.selectPrompt")}</p>
                    ) : productLoading ? (
                        <p className="text-sm text-slate-500">{tx("common.loading")}</p>
                    ) : filteredProducts.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            {productSearch.trim() ? tx("admin.branches.productsSearchEmpty") : tx("admin.branches.productsEmpty")}
                        </p>
                    ) : (
                        <div className="grid gap-4 xl:grid-cols-2">
                            {filteredProducts.map((product) => (
                                <div key={product.productId} className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{product.productName}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                                                <span className="font-semibold text-slate-900">{formatTHB(product.price)}</span>
                                                {product.priceOverride != null ? (
                                                    <span className="text-slate-500">
                                                        {tx("admin.branches.basePriceLabel")} {formatTHB(product.basePrice)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">{tx("admin.branches.usingBasePrice")}</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(product.isEnabled && !product.isTemporarilyClosed ? "open" : "closed")}`}>
                                            {statusLabel(product, tx)}
                                        </span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {product.categories.map((category) => (
                                            <span key={`${product.productId}-${category.id}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                                {category.name}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                                        <p>{tx("admin.branches.stockLabel")}: {product.stockQty ?? "-"}</p>
                                        <p>{tx("admin.branches.reorderLabel")}: {product.reorderLevel ?? "-"}</p>
                                        <p>{tx("admin.branches.lowStockLabel")}: {product.isLowStock ? tx("admin.branches.yes") : tx("admin.branches.no")}</p>
                                    </div>

                                    <div className="mt-4 rounded-[1.25rem] bg-slate-50 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-slate-700">{tx("admin.branches.addOnSummaryTitle")}</p>
                                            <span className="text-xs font-semibold text-slate-500">
                                                {tx("admin.branches.addOnCount", { count: product.addOns.length })}
                                            </span>
                                        </div>
                                        {product.addOns.length > 0 ? (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {product.addOns.slice(0, 4).map((addOn) => (
                                                    <span key={addOn.addOnId} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                                                        {addOn.name}
                                                    </span>
                                                ))}
                                                {product.addOns.length > 4 ? (
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                                                        {tx("admin.branches.addOnMore", { count: product.addOns.length - 4 })}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <p className="mt-2 text-sm text-slate-500">{tx("admin.branches.addOnEmpty")}</p>
                                        )}
                                    </div>

                                    {product.availabilityNote ? (
                                        <p className="mt-3 text-sm text-slate-500">{product.availabilityNote}</p>
                                    ) : null}

                                    {(canManageStock || canRead) ? (
                                        <div className="mt-4 flex flex-wrap gap-3">
                                            {canManageStock ? (
                                                <>
                                                    <button type="button" onClick={() => openProductModal(product)} className={adminButtonPrimaryClass}>
                                                        {tx("admin.branches.productEditAction")}
                                                    </button>
                                                    <button type="button" onClick={() => openStockModal(product)} className={adminButtonSecondaryClass}>
                                                        {tx("admin.branches.productStockAction")}
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </AdminSectionCard>

                <Modal
                    open={createModalOpen}
                    onClose={closeCreateModal}
                    title={tx("admin.branches.createTitle")}
                    size="lg"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeCreateModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="create-branch-form" disabled={createSaving} className={adminButtonPrimaryClass}>
                                {createSaving ? tx("common.processing") : tx("admin.branches.createAction")}
                            </button>
                        </div>
                    }
                >
                    <form id="create-branch-form" className="space-y-6" onSubmit={handleCreateBranch}>
                        {createSubmitError ? (
                            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {createSubmitError}
                            </div>
                        ) : null}

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.createSectionBranch")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.branches.createSectionBranchDescription")}</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={tx("admin.branches.field.name")} error={createFieldErrors.name}>
                                    <input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.name)} />
                                </Field>
                                <Field label={tx("admin.branches.field.slug")} error={createFieldErrors.slug} helper={tx("admin.branches.slugHelper")}>
                                    <input value={createForm.slug} onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.slug)} />
                                </Field>
                                <Field label={tx("admin.branches.field.addressLine")}>
                                    <input value={createForm.addressLine} onChange={(event) => setCreateForm((current) => ({ ...current, addressLine: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.addressLine)} />
                                </Field>
                                <Field label={tx("admin.branches.field.imageUrl")}>
                                    <input value={createForm.imageUrl} onChange={(event) => setCreateForm((current) => ({ ...current, imageUrl: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.imageUrl)} />
                                </Field>
                                <Field label={tx("admin.branches.field.lat")}>
                                    <input value={createForm.lat} onChange={(event) => setCreateForm((current) => ({ ...current, lat: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.lat)} />
                                </Field>
                                <Field label={tx("admin.branches.field.lng")}>
                                    <input value={createForm.lng} onChange={(event) => setCreateForm((current) => ({ ...current, lng: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.lng)} />
                                </Field>
                            </div>
                            <Field label={tx("admin.branches.field.description")}>
                                <textarea value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} rows={3} className={getAdminFieldClass(!!createFieldErrors.description)} />
                            </Field>
                        </section>

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.createSectionOperations")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.branches.createSectionOperationsDescription")}</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={createForm.acceptingOrders} onChange={(event) => setCreateForm((current) => ({ ...current, acceptingOrders: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.acceptingOrders")}</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={createForm.isForceClosed} onChange={(event) => setCreateForm((current) => ({ ...current, isForceClosed: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.forceClosed")}</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={createForm.supportsPickup} onChange={(event) => setCreateForm((current) => ({ ...current, supportsPickup: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.supportsPickup")}</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={createForm.supportsRiderDelivery} onChange={(event) => setCreateForm((current) => ({ ...current, supportsRiderDelivery: event.target.checked }))} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.supportsDelivery")}</span>
                                </label>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label={tx("admin.branches.field.riderDeliveryFee")} error={createFieldErrors.riderDeliveryFee}>
                                    <input value={createForm.riderDeliveryFee} onChange={(event) => setCreateForm((current) => ({ ...current, riderDeliveryFee: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.riderDeliveryFee)} />
                                </Field>
                                <Field label={tx("admin.branches.field.operationalNote")}>
                                    <input value={createForm.operationalNote} onChange={(event) => setCreateForm((current) => ({ ...current, operationalNote: event.target.value }))} className={getAdminFieldClass(!!createFieldErrors.operationalNote)} />
                                </Field>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div>
                                <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.createSectionCopy")}</h3>
                                <p className={adminFieldHelperClass}>{tx("admin.branches.createSectionCopyDescription")}</p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {(["none", "all", "selected"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                copyMode: mode,
                                                copyFromBranchId: mode === "none" ? "" : current.copyFromBranchId,
                                                categoryIds: mode === "selected" ? current.categoryIds : [],
                                                productIds: mode === "selected" ? current.productIds : [],
                                            }))
                                        }
                                        className={copyModeButtonClass(createForm.copyMode === mode)}
                                    >
                                        {tx(`admin.branches.copyMode.${mode}`)}
                                    </button>
                                ))}
                            </div>

                            {createForm.copyMode !== "none" ? (
                                <Field label={tx("admin.branches.field.copyFromBranch")} error={createFieldErrors.copyFromBranchId}>
                                    <select
                                        value={createForm.copyFromBranchId}
                                        onChange={(event) =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                copyFromBranchId: event.target.value,
                                                categoryIds: [],
                                                productIds: [],
                                            }))
                                        }
                                        className={getAdminFieldClass(!!createFieldErrors.copyFromBranchId)}
                                    >
                                        <option value="">{tx("admin.branches.copyFromPlaceholder")}</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            ) : null}

                            {createForm.copyMode === "selected" && createForm.copyFromBranchId ? (
                                <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                                    {sourceProductsLoading ? <p className="text-sm text-slate-500">{tx("common.loading")}</p> : null}
                                    {!sourceProductsLoading && sourceProducts.length === 0 ? (
                                        <p className="text-sm text-slate-500">{tx("admin.branches.copyEmpty")}</p>
                                    ) : null}
                                    {!sourceProductsLoading && sourceProducts.length > 0 ? (
                                        <>
                                            <div>
                                                <p className={adminFieldLabelClass}>{tx("admin.branches.field.copyCategories")}</p>
                                                <p className={adminFieldHelperClass}>{tx("admin.branches.copyCategoriesHelper")}</p>
                                                <div className="mt-3 flex flex-wrap gap-3">
                                                    {sourceCategories.map((category) => {
                                                        const active = createForm.categoryIds.includes(category.id);
                                                        return (
                                                            <button
                                                                key={category.id}
                                                                type="button"
                                                                onClick={() => toggleCreateCategory(category.id)}
                                                                className={active ? "rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950" : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"}
                                                            >
                                                                {category.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div>
                                                <p className={adminFieldLabelClass}>{tx("admin.branches.field.copyProducts")}</p>
                                                <p className={adminFieldHelperClass}>{tx("admin.branches.copyProductsHelper")}</p>
                                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                                    {sourceProducts.map((product) => {
                                                        const active = createForm.productIds.includes(product.productId);
                                                        return (
                                                            <label
                                                                key={product.productId}
                                                                className={`flex items-start gap-3 rounded-[1.25rem] border px-4 py-3 ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                                                            >
                                                                <input type="checkbox" checked={active} onChange={() => toggleCreateProduct(product.productId)} />
                                                                <span>
                                                                    <span className="block text-sm font-medium text-slate-800">{product.productName}</span>
                                                                    <span className="mt-1 block text-xs text-slate-500">
                                                                        {product.categories.map((category) => category.name).join(", ")}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {createFieldErrors.productIds ? <p className={`mt-2 ${adminFieldErrorClass}`}>{createFieldErrors.productIds}</p> : null}
                                                {createFieldErrors.categoryIds ? <p className={`mt-2 ${adminFieldErrorClass}`}>{createFieldErrors.categoryIds}</p> : null}
                                            </div>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                        </section>
                    </form>
                </Modal>

                <Modal
                    open={editModalOpen}
                    onClose={closeEditModal}
                    title={tx("admin.branches.editTitle")}
                    size="md"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeEditModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="edit-branch-form" disabled={editSaving} className={adminButtonPrimaryClass}>
                                {editSaving ? tx("common.updating") : tx("admin.branches.editSaveAction")}
                            </button>
                        </div>
                    }
                >
                    <form id="edit-branch-form" className="space-y-5" onSubmit={handleSaveBranch}>
                        {editSubmitError ? (
                            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {editSubmitError}
                            </div>
                        ) : null}
                        {editForm ? (
                            <>
                                <Field label={tx("admin.branches.field.name")} error={editFieldErrors.name}>
                                    <input value={editForm.name} onChange={(event) => setEditForm((current) => current ? { ...current, name: event.target.value } : current)} className={getAdminFieldClass(!!editFieldErrors.name)} />
                                </Field>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={editForm.acceptingOrders} onChange={(event) => setEditForm((current) => current ? { ...current, acceptingOrders: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.acceptingOrders")}</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={editForm.isForceClosed} onChange={(event) => setEditForm((current) => current ? { ...current, isForceClosed: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.forceClosed")}</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={editForm.supportsPickup} onChange={(event) => setEditForm((current) => current ? { ...current, supportsPickup: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.supportsPickup")}</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={editForm.supportsRiderDelivery} onChange={(event) => setEditForm((current) => current ? { ...current, supportsRiderDelivery: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.supportsDelivery")}</span>
                                    </label>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label={tx("admin.branches.field.riderDeliveryFee")} error={editFieldErrors.riderDeliveryFee}>
                                        <input value={editForm.riderDeliveryFee} onChange={(event) => setEditForm((current) => current ? { ...current, riderDeliveryFee: event.target.value } : current)} className={getAdminFieldClass(!!editFieldErrors.riderDeliveryFee)} />
                                    </Field>
                                    <Field label={tx("admin.branches.field.operationalNote")}>
                                        <input value={editForm.operationalNote} onChange={(event) => setEditForm((current) => current ? { ...current, operationalNote: event.target.value } : current)} className={getAdminFieldClass(!!editFieldErrors.operationalNote)} />
                                    </Field>
                                </div>
                            </>
                        ) : null}
                    </form>
                </Modal>

                <Modal
                    open={selectedProduct != null && productForm != null}
                    onClose={closeProductModal}
                    title={tx("admin.branches.productModalTitle")}
                    size="lg"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeProductModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="product-override-form" disabled={productSaving} className={adminButtonPrimaryClass}>
                                {productSaving ? tx("common.updating") : tx("admin.branches.productSaveAction")}
                            </button>
                        </div>
                    }
                >
                    {selectedProduct && productForm ? (
                        <form id="product-override-form" className="space-y-5" onSubmit={handleSaveProduct}>
                            {productSubmitError ? (
                                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {productSubmitError}
                                </div>
                            ) : null}

                            <div className={adminSurfaceMutedClass}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-slate-900">{selectedProduct.productName}</p>
                                        <div className="mt-1 space-y-1 text-sm text-slate-500">
                                            <p>{tx("admin.branches.basePriceLabel")} {formatTHB(selectedProduct.basePrice)}</p>
                                            <p>{tx("admin.branches.effectivePriceLabel")} {formatTHB(selectedProduct.price)}</p>
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedProduct.isEnabled && !selectedProduct.isTemporarilyClosed ? "open" : "closed")}`}>
                                        {statusLabel(selectedProduct, tx)}
                                    </span>
                                </div>
                            </div>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.productSectionSellability")}</h3>
                                    <p className={adminFieldHelperClass}>{tx("admin.branches.productSectionSellabilityDescription")}</p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={productForm.isEnabled} onChange={(event) => setProductForm((current) => current ? { ...current, isEnabled: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.productEnabled")}</span>
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                        <input type="checkbox" checked={productForm.isTemporarilyClosed} onChange={(event) => setProductForm((current) => current ? { ...current, isTemporarilyClosed: event.target.checked } : current)} />
                                        <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.productTemporarilyClosed")}</span>
                                    </label>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.productSectionPricing")}</h3>
                                    <p className={adminFieldHelperClass}>{tx("admin.branches.productSectionPricingDescription")}</p>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {(["base", "override"] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setProductForm((current) => current ? { ...current, priceMode: mode } : current)}
                                            className={copyModeButtonClass(productForm.priceMode === mode)}
                                        >
                                            {tx(`admin.branches.priceMode.${mode}`)}
                                        </button>
                                    ))}
                                </div>

                                {productForm.priceMode === "override" ? (
                                    <Field label={tx("admin.branches.field.priceOverride")} error={productFieldErrors.priceOverride} helper={tx("admin.branches.priceOverrideHelper")}>
                                        <input
                                            value={productForm.priceOverride}
                                            onChange={(event) => setProductForm((current) => current ? { ...current, priceOverride: event.target.value } : current)}
                                            className={getAdminFieldClass(!!productFieldErrors.priceOverride)}
                                        />
                                    </Field>
                                ) : (
                                    <p className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                        {tx("admin.branches.usingBasePriceValue", { price: formatTHB(selectedProduct.basePrice) })}
                                    </p>
                                )}
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.productSectionStock")}</h3>
                                    <p className={adminFieldHelperClass}>{tx("admin.branches.productSectionStockDescription")}</p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <Field label={tx("admin.branches.field.stockQty")} error={productFieldErrors.stockQty}>
                                        <input value={productForm.stockQty} onChange={(event) => setProductForm((current) => current ? { ...current, stockQty: event.target.value } : current)} className={getAdminFieldClass(!!productFieldErrors.stockQty)} />
                                    </Field>
                                    <Field label={tx("admin.branches.field.reorderLevel")} error={productFieldErrors.reorderLevel}>
                                        <input value={productForm.reorderLevel} onChange={(event) => setProductForm((current) => current ? { ...current, reorderLevel: event.target.value } : current)} className={getAdminFieldClass(!!productFieldErrors.reorderLevel)} />
                                    </Field>
                                </div>

                                <Field label={tx("admin.branches.field.availabilityNote")} helper={tx("admin.branches.availabilityNoteHelper")} error={productFieldErrors.availabilityNote}>
                                    <textarea value={productForm.availabilityNote} onChange={(event) => setProductForm((current) => current ? { ...current, availabilityNote: event.target.value } : current)} rows={3} className={getAdminFieldClass(!!productFieldErrors.availabilityNote)} />
                                </Field>
                            </section>

                            <section className="space-y-4">
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900">{tx("admin.branches.productSectionAddOns")}</h3>
                                    <p className={adminFieldHelperClass}>{tx("admin.branches.productSectionAddOnsDescription")}</p>
                                </div>

                                {selectedProduct.addOns.length === 0 ? (
                                    <p className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                        {tx("admin.branches.addOnEmpty")}
                                    </p>
                                ) : (
                                    <div className="grid gap-3">
                                        {selectedProduct.addOns.map((addOn) => (
                                            <div key={addOn.addOnId} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-sm font-semibold text-slate-900">{addOn.name}</p>
                                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                                                {addOn.groupName}
                                                            </span>
                                                        </div>
                                                        <div className="mt-2 space-y-1 text-sm text-slate-500">
                                                            <p>{tx("admin.branches.basePriceLabel")} {formatTHB(addOn.basePrice)}</p>
                                                            <p>{tx("admin.branches.effectivePriceLabel")} {formatTHB(addOn.price)}</p>
                                                        </div>
                                                        {addOn.availabilityNote ? <p className="mt-2 text-sm text-slate-500">{addOn.availabilityNote}</p> : null}
                                                    </div>
                                                    <div className="flex flex-col items-start gap-3 md:items-end">
                                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(addOn.isEnabled && !addOn.isTemporarilyClosed ? "open" : "closed")}`}>
                                                            {addOnStatusLabel(addOn, tx)}
                                                        </span>
                                                        <button type="button" onClick={() => openAddOnModal(addOn)} className={adminButtonSecondaryClass}>
                                                            {tx("admin.branches.addOnEditAction")}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </form>
                    ) : null}
                </Modal>

                <Modal
                    open={selectedAddOn != null && addOnForm != null}
                    onClose={closeAddOnModal}
                    title={tx("admin.branches.addOnModalTitle")}
                    size="md"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeAddOnModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="add-on-override-form" disabled={addOnSaving} className={adminButtonPrimaryClass}>
                                {addOnSaving ? tx("common.updating") : tx("admin.branches.addOnSaveAction")}
                            </button>
                        </div>
                    }
                >
                    {selectedAddOn && addOnForm ? (
                        <form id="add-on-override-form" className="space-y-5" onSubmit={handleSaveAddOn}>
                            {addOnSubmitError ? (
                                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {addOnSubmitError}
                                </div>
                            ) : null}

                            <div className={adminSurfaceMutedClass}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-base font-semibold text-slate-900">{selectedAddOn.name}</p>
                                        <p className="mt-1 text-sm text-slate-500">{selectedProduct?.productName}</p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(selectedAddOn.isEnabled && !selectedAddOn.isTemporarilyClosed ? "open" : "closed")}`}>
                                        {addOnStatusLabel(selectedAddOn, tx)}
                                    </span>
                                </div>
                                <div className="mt-3 space-y-1 text-sm text-slate-500">
                                    <p>{tx("admin.branches.basePriceLabel")} {formatTHB(selectedAddOn.basePrice)}</p>
                                    <p>{tx("admin.branches.effectivePriceLabel")} {formatTHB(selectedAddOn.price)}</p>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={addOnForm.isEnabled} onChange={(event) => setAddOnForm((current) => current ? { ...current, isEnabled: event.target.checked } : current)} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.addOnEnabled")}</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                                    <input type="checkbox" checked={addOnForm.isTemporarilyClosed} onChange={(event) => setAddOnForm((current) => current ? { ...current, isTemporarilyClosed: event.target.checked } : current)} />
                                    <span className="text-sm font-medium text-slate-700">{tx("admin.branches.field.addOnTemporarilyClosed")}</span>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {(["base", "override"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setAddOnForm((current) => current ? { ...current, priceMode: mode } : current)}
                                        className={copyModeButtonClass(addOnForm.priceMode === mode)}
                                    >
                                        {tx(`admin.branches.priceMode.${mode}`)}
                                    </button>
                                ))}
                            </div>

                            {addOnForm.priceMode === "override" ? (
                                <Field label={tx("admin.branches.field.addOnPriceOverride")} error={addOnFieldErrors.priceOverride} helper={tx("admin.branches.addOnPriceOverrideHelper")}>
                                    <input
                                        value={addOnForm.priceOverride}
                                        onChange={(event) => setAddOnForm((current) => current ? { ...current, priceOverride: event.target.value } : current)}
                                        className={getAdminFieldClass(!!addOnFieldErrors.priceOverride)}
                                    />
                                </Field>
                            ) : (
                                <p className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                    {tx("admin.branches.usingBasePriceValue", { price: formatTHB(selectedAddOn.basePrice) })}
                                </p>
                            )}

                            <Field label={tx("admin.branches.field.addOnAvailabilityNote")} helper={tx("admin.branches.addOnAvailabilityNoteHelper")} error={addOnFieldErrors.availabilityNote}>
                                <textarea
                                    value={addOnForm.availabilityNote}
                                    onChange={(event) => setAddOnForm((current) => current ? { ...current, availabilityNote: event.target.value } : current)}
                                    rows={3}
                                    className={getAdminFieldClass(!!addOnFieldErrors.availabilityNote)}
                                />
                            </Field>
                        </form>
                    ) : null}
                </Modal>

                <Modal
                    open={stockModalOpen}
                    onClose={closeStockModal}
                    title={tx("admin.branches.stockModalTitle")}
                    size="md"
                    footer={
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={closeStockModal} className={adminButtonSecondaryClass}>
                                {tx("common.cancel")}
                            </button>
                            <button type="submit" form="stock-adjustment-form" disabled={stockSaving} className={adminButtonPrimaryClass}>
                                {stockSaving ? tx("common.processing") : tx("admin.branches.stockModalAction")}
                            </button>
                        </div>
                    }
                >
                    <form id="stock-adjustment-form" className="space-y-5" onSubmit={handleAdjustStock}>
                        {stockSubmitError ? (
                            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {stockSubmitError}
                            </div>
                        ) : null}
                        <Field label={tx("admin.branches.field.stockProduct")} error={stockFieldErrors.productId}>
                            <select value={stockForm.productId} onChange={(event) => setStockForm((current) => ({ ...current, productId: event.target.value }))} className={getAdminFieldClass(!!stockFieldErrors.productId)}>
                                <option value="">{tx("admin.branches.stockProductPlaceholder")}</option>
                                {products.map((product) => (
                                    <option key={product.productId} value={product.productId}>
                                        {product.productName}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label={tx("admin.branches.field.deltaQty")} error={stockFieldErrors.deltaQty}>
                                <input value={stockForm.deltaQty} onChange={(event) => setStockForm((current) => ({ ...current, deltaQty: event.target.value }))} className={getAdminFieldClass(!!stockFieldErrors.deltaQty)} />
                            </Field>
                            <Field label={tx("admin.branches.field.reason")}>
                                <select value={stockForm.reason} onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value }))} className={getAdminFieldClass()}>
                                    <option value="restock">{tx("admin.branches.stockReason.restock")}</option>
                                    <option value="sale_adjustment">{tx("admin.branches.stockReason.saleAdjustment")}</option>
                                    <option value="waste">{tx("admin.branches.stockReason.waste")}</option>
                                    <option value="correction">{tx("admin.branches.stockReason.correction")}</option>
                                </select>
                            </Field>
                        </div>
                        <Field label={tx("admin.branches.field.stockNote")} error={stockFieldErrors.reason}>
                            <input value={stockForm.note} onChange={(event) => setStockForm((current) => ({ ...current, note: event.target.value }))} className={getAdminFieldClass(!!stockFieldErrors.reason)} />
                        </Field>
                    </form>
                </Modal>
            </div>
        </AdminLayout>
    );
}

import type { CartBranchGroup, CartItem } from "@/types";

function sanitizeProduct(item: any): CartItem | null {
    if (!item || typeof item !== "object") {
        return null;
    }
    const qty = Number((item as any).qty);
    const price = Number((item as any).price);
    const productId = (item as any).productId;
    const productName = (item as any).productName;
    if (!Number.isFinite(qty) || !Number.isFinite(price)) {
        return null;
    }
    const normalizedAddOns = Array.isArray((item as any).productAddOns)
        ? (item as any).productAddOns
              .filter((addon: any) => addon && typeof addon === "object")
              .map((addon: any) => ({
                  name: typeof addon.name === "string" ? addon.name : String(addon.name ?? ""),
                  price: Number(addon.price) || 0,
              }))
        : [];
    return {
        productId: typeof productId === "string" ? productId : String(productId ?? ""),
        productName: typeof productName === "string" ? productName : String(productName ?? ""),
        qty: Math.max(0, Math.floor(qty)),
        price: Number.isFinite(price) ? price : 0,
        productAddOns: normalizedAddOns,
    };
}

function sanitizeBranch(branch: any): CartBranchGroup | null {
    if (!branch || typeof branch !== "object") {
        return null;
    }
    const branchIdRaw = (branch as any).branchId;
    const companyIdRaw = (branch as any).companyId;
    const branchNameRaw = (branch as any).branchName;
    if (
        (typeof branchIdRaw !== "string" && typeof branchIdRaw !== "number") ||
        (typeof companyIdRaw !== "string" && typeof companyIdRaw !== "number") ||
        typeof branchNameRaw !== "string"
    ) {
        return null;
    }
    const productsRaw = Array.isArray((branch as any).productList) ? (branch as any).productList : [];
    const productList = productsRaw
        .map((item: any) => sanitizeProduct(item))
        .filter((item): item is CartItem => item != null);
    if (productList.length === 0) {
        return null;
    }
    return {
        branchId: typeof branchIdRaw === "string" ? branchIdRaw : String(branchIdRaw),
        companyId: typeof companyIdRaw === "string" ? companyIdRaw : String(companyIdRaw),
        branchName: branchNameRaw,
        productList,
    };
}

export function sanitizeCard(input: any): CartBranchGroup[] {
    if (!Array.isArray(input)) {
        return [];
    }
    return input
        .map((branch) => sanitizeBranch(branch))
        .filter((branch): branch is CartBranchGroup => branch != null);
}

export function stripCardExtras(input: CartBranchGroup[]): CartBranchGroup[] {
    return input.map((branch) => ({
        branchId: branch.branchId,
        companyId: branch.companyId,
        branchName: branch.branchName,
        productList: branch.productList.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            qty: item.qty,
            productAddOns: item.productAddOns.map((addon) => ({ ...addon })),
        })),
    }));
}

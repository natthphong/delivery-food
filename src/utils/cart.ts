import type { CartAddOn, CartBranchGroup, CartItem } from "@/types";

export function totalItemCount(card: CartBranchGroup[] | null | undefined): number {
    if (!Array.isArray(card)) return 0;
    return card.reduce((acc, group) => acc + (group.productList?.length ?? 0), 0);
}

export function totalQty(card: CartBranchGroup[] | null | undefined): number {
    if (!Array.isArray(card)) return 0;
    return card.reduce((acc, group) => {
        const branchQty = (group.productList || []).reduce((sum, item) => sum + (item.qty ?? 0), 0);
        return acc + branchQty;
    }, 0);
}

export function canonicalizeAddOns(addOns: CartAddOn[]): string {
    const sorted = [...(addOns || [])].sort((a, b) => {
        if (a.name === b.name) {
            return a.price - b.price;
        }
        return a.name.localeCompare(b.name);
    });
    return JSON.stringify(sorted);
}

export function buildCartItemKey(branchId: string, item: CartItem): string {
    return `${branchId}|${item.productId}|${canonicalizeAddOns(item.productAddOns)}`;
}

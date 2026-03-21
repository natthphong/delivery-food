import type { Cart } from "@/types";

export type CheckoutDraft = {
    branchId: number;
    itemIds: number[];
};

export const CHECKOUT_DRAFT_KEY = "CHECKOUT_DRAFT";

export function loadCheckoutDraft(): CheckoutDraft | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as CheckoutDraft;
        return {
            branchId: Number(parsed.branchId),
            itemIds: Array.isArray(parsed.itemIds) ? parsed.itemIds.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [],
        };
    } catch {
        return null;
    }
}

export function saveCheckoutDraft(draft: CheckoutDraft) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({
            branchId: draft.branchId,
            itemIds: Array.from(new Set(draft.itemIds)).sort((a, b) => a - b),
        })
    );
}

export function clearCheckoutDraft() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

export function reconcileCheckoutDraft(cart: Cart, draft: CheckoutDraft | null): CheckoutDraft | null {
    if (!draft) return null;
    const group = cart.groups.find((item) => item.branchId === draft.branchId);
    if (!group) return null;
    const validItemIds = group.items.map((item) => item.id).filter((itemId) => draft.itemIds.includes(itemId));
    if (validItemIds.length === 0) return null;
    return {
        branchId: draft.branchId,
        itemIds: validItemIds,
    };
}

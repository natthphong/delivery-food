import type { BranchSummary, Cart, CartBranchGroup, CartItem } from "@/types";
import type { AdminBranchProduct } from "@/types/admin";
import type { AdminOrder } from "@/types/adminOrder";
import type { Order, OrderItem } from "@/types/transaction";

function normalizeCartItem(item: CartItem): CartItem {
    return {
        ...item,
        addOns: Array.isArray(item.addOns) ? item.addOns : [],
    };
}

function normalizeCartGroup(group: CartBranchGroup): CartBranchGroup {
    return {
        ...group,
        items: Array.isArray(group.items) ? group.items.map(normalizeCartItem) : [],
    };
}

function normalizeOrderItem(item: OrderItem): OrderItem {
    return {
        ...item,
        addOns: Array.isArray(item.addOns) ? item.addOns : [],
    };
}

function normalizeBranch(branch: BranchSummary | null | undefined): BranchSummary | null {
    if (!branch) {
        return null;
    }
    return {
        ...branch,
        openHours: Array.isArray(branch.openHours) ? branch.openHours : [],
    };
}

export function normalizeCart(cart: Cart | null | undefined): Cart {
    if (!cart) {
        return {
            groups: [],
            totalAmount: 0,
            totalItems: 0,
            totalQuantity: 0,
            lastSyncedAt: new Date(0).toISOString(),
        };
    }
    return {
        ...cart,
        groups: Array.isArray(cart.groups) ? cart.groups.map(normalizeCartGroup) : [],
    };
}

export function normalizeOrder<T extends Order | null | undefined>(order: T): T {
    if (!order) {
        return order;
    }
    return {
        ...order,
        items: Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [],
        branch: normalizeBranch(order.branch),
    } as T;
}

export function normalizeAdminOrder(order: AdminOrder): AdminOrder {
    return {
        ...normalizeOrder(order),
        allowedStatuses: Array.isArray(order.allowedStatuses) ? order.allowedStatuses : [],
    };
}

export function normalizeAdminBranchProduct(product: AdminBranchProduct): AdminBranchProduct {
    return {
        ...product,
        categories: Array.isArray(product.categories) ? product.categories : [],
    };
}

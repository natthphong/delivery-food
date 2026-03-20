import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./index";
import { EMPTY_ARRAY } from "./constants";

export const selectUser = (state: RootState) => state.auth.user;
export const selectCart = (state: RootState) => state.cart.value;
export const selectCartGroups = createSelector([selectCart], (cart) => {
    if (!Array.isArray(cart.groups) || cart.groups.length === 0) {
        return EMPTY_ARRAY;
    }
    return cart.groups;
});

export const selectCartItems = createSelector([selectCartGroups], (groups) => {
    if (!Array.isArray(groups) || groups.length === 0) {
        return EMPTY_ARRAY;
    }
    const items = groups.flatMap((group) => (Array.isArray(group.items) ? group.items : EMPTY_ARRAY));
    return items.length > 0 ? items : EMPTY_ARRAY;
});

export const selectCartCount = createSelector([selectCart], (cart) => cart.totalQuantity ?? 0);
export const selectUserCard = selectCartGroups;
export const selectUserCardItems = selectCartItems;

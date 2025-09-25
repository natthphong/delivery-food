import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./index";
import { EMPTY_ARRAY, EMPTY_OBJECT } from "./constants";
import { totalItemCount } from "@/utils/cart";

export const selectUser = (state: RootState) => state.auth.user;

export const selectUserCard = createSelector([selectUser], (user) => {
    if (!user) {
        return EMPTY_ARRAY;
    }
    return Array.isArray(user.card) ? user.card : EMPTY_ARRAY;
});

export const selectUserCardItems = createSelector([selectUserCard], (groups) => {
    if (!Array.isArray(groups) || groups.length === 0) {
        return EMPTY_ARRAY;
    }
    const items = groups.flatMap((group) => (Array.isArray(group.productList) ? group.productList : EMPTY_ARRAY));
    return items.length > 0 ? items : EMPTY_ARRAY;
});

export const selectCartCount = createSelector([selectUserCard], (groups) => totalItemCount(groups));

export const selectUserCardMeta = createSelector([selectUser], (user) => user?.card ?? EMPTY_OBJECT);

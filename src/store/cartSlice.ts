import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Cart } from "@/types";

export const emptyCart: Cart = {
    groups: [],
    totalAmount: 0,
    totalItems: 0,
    totalQuantity: 0,
    lastSyncedAt: new Date(0).toISOString(),
};

type State = {
    value: Cart;
};

const initialState: State = {
    value: emptyCart,
};

const slice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        setCart(state, action: PayloadAction<Cart>) {
            state.value = action.payload;
        },
        clearCart(state) {
            state.value = emptyCart;
        },
    },
});

export const { setCart, clearCart } = slice.actions;
export default slice.reducer;

import type { NextRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "@/utils/firebaseClient";
import { logout } from "@/store/authSlice";
import { clearCart as clearCartState, setCart } from "@/store/cartSlice";
import { clearConfig as clearConfigState } from "@/store/configSlice";
import type { AppDispatch } from "@/store";
import { clearCart, clearConfig, clearTokens, clearUser } from "@/utils/tokenStorage";

const EMPTY_CART = {
    groups: [],
    totalAmount: 0,
    totalItems: 0,
    totalQuantity: 0,
    lastSyncedAt: new Date(0).toISOString(),
};

export async function logoutCustomer(dispatch: AppDispatch, router: NextRouter) {
    await signOut(auth).catch(() => undefined);
    dispatch(logout());
    dispatch(clearCartState());
    dispatch(clearConfigState());
    dispatch(setCart(EMPTY_CART));
    clearTokens();
    clearUser();
    clearCart();
    clearConfig();
    if (typeof window !== "undefined") {
        window.localStorage.removeItem("CHECKOUT_DRAFT");
    }
    await router.replace("/login");
}

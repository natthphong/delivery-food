import axios, { type ApiResponse } from "@/utils/apiClient";
import type { Cart } from "@/types";
import { unwrapResponse } from "@/services/api";

export async function fetchCart() {
    const { data } = await axios.get<ApiResponse<Cart>>("/v1/cart");
    return unwrapResponse(data);
}

export async function addCartItem(payload: { branchId: number; productId: number; quantity: number; addOnIds: number[] }) {
    const { data } = await axios.post<ApiResponse<Cart>>("/v1/cart/items", payload);
    return unwrapResponse(data);
}

export async function updateCartItem(itemId: number, quantity: number) {
    const { data } = await axios.patch<ApiResponse<Cart>>(`/v1/cart/items/${itemId}`, { quantity });
    return unwrapResponse(data);
}

export async function removeCartItem(itemId: number) {
    const { data } = await axios.delete<ApiResponse<Cart>>(`/v1/cart/items/${itemId}`);
    return unwrapResponse(data);
}

export async function clearCartBranch(branchId: number) {
    const { data } = await axios.delete<ApiResponse<Cart>>(`/v1/cart/branches/${branchId}`);
    return unwrapResponse(data);
}

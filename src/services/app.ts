import axios, { type ApiResponse } from "@/utils/apiClient";
import type { BootstrapPayload, UserRecord } from "@/types";
import type { Order, TransactionSummary } from "@/types/transaction";
import { unwrapResponse } from "@/services/api";
import { normalizeCart, normalizeOrder } from "@/services/normalizers";

export async function fetchBootstrap() {
    const { data } = await axios.get<ApiResponse<BootstrapPayload>>("/v1/bootstrap");
    const payload = unwrapResponse(data);
    return {
        ...payload,
        cart: normalizeCart(payload.cart),
    };
}

export async function updateProfile(payload: {
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
    isEmailVerified?: boolean | null;
    isPhoneVerified?: boolean | null;
}) {
    const { data } = await axios.patch<ApiResponse<{ user: UserRecord }>>("/v1/account/profile", payload);
    return unwrapResponse(data).user;
}

export async function fetchTransactions(limit = 50) {
    const { data } = await axios.get<ApiResponse<{ transactions: TransactionSummary[] }>>("/v1/account/transactions", {
        params: { limit },
    });
    return unwrapResponse(data).transactions;
}

export async function fetchOrders(limit = 50) {
    const { data } = await axios.get<ApiResponse<{ orders: Order[] }>>("/v1/account/orders", {
        params: { limit },
    });
    return unwrapResponse(data).orders.map(normalizeOrder);
}

export async function sendVerificationEmail(locale: "th" | "en") {
    const { data } = await axios.post<ApiResponse<{ sent: boolean }>>("/v1/account/email/verification", { locale });
    return unwrapResponse(data).sent;
}

export async function verifyEmailToken(token: string) {
    const { data } = await axios.post<ApiResponse<{ user: UserRecord; verified: boolean }>>("/v1/account/email/verify", { token });
    return unwrapResponse(data);
}

import axios, { type ApiResponse } from "@/utils/apiClient";
import type { Cart, UserRecord } from "@/types";
import type { Order, TransactionDetail, TransactionSummary, TransactionMethod } from "@/types/transaction";
import { unwrapResponse } from "@/services/api";

export type CheckoutResult = {
    method: TransactionMethod;
    transaction: TransactionSummary;
    order: Order | null;
    cart: Cart;
    user?: UserRecord | null;
};

export async function checkout(payload: {
    branchId: number;
    paymentMethodId: number;
    selectedItemIds: number[];
    fulfillmentMode: "pickup" | "rider_delivery";
    customerNote?: string;
    deliveryLat: number;
    deliveryLng: number;
    deliveryDistanceKm: number;
}) {
    const { data } = await axios.post<ApiResponse<CheckoutResult>>("/v1/checkout", payload);
    return unwrapResponse(data);
}

export async function createDeposit(payload: { companyId: number; paymentMethodId: number; amount: number }) {
    const { data } = await axios.post<ApiResponse<{ transaction: TransactionSummary }>>("/v1/deposits", payload);
    return unwrapResponse(data).transaction;
}

export async function fetchTransactionDetail(transactionId: number) {
    const { data } = await axios.get<ApiResponse<TransactionDetail>>(`/v1/transactions/${transactionId}`);
    return unwrapResponse(data);
}

export async function submitTransactionSlip(transactionId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await axios.post<ApiResponse<TransactionDetail>>(`/v1/transactions/${transactionId}/slip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrapResponse(data);
}

export async function retryTransactionPayment(transactionId: number, payload: { paymentMethodId?: number | null } = {}) {
    const { data } = await axios.post<ApiResponse<TransactionDetail>>(`/v1/transactions/${transactionId}/retry`, payload);
    return unwrapResponse(data);
}

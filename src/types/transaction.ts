import type { BranchSummary, CartAddOn, UserRecord } from "@/types";
import type { DeliveryJob } from "@/types/admin";

export type TxnStatus = "pending" | "accepted" | "rejected" | "expired";
export type TxnType = "deposit" | "payment";
export type TxnMethodType = "qr" | "balance" | "gateway";
export type OrderStatus = "PENDING" | "PREPARE" | "READY" | "DELIVERY" | "COMPLETED" | "REJECTED";

export type PaymentAction = {
    type?: string;
    provider?: string;
    providerName?: string;
    checkoutFlow?: string;
    amount?: number;
    currency?: string;
    expiresAt?: string;
    promptPayId?: string;
    qrImageUrl?: string;
    authorizeUri?: string;
    providerStatus?: string;
    status?: string | null;
    sourceChargeStatus?: string | null;
    paid?: boolean;
    authorized?: boolean;
    paidAt?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    sourceId?: string;
    chargeId?: string;
    branchName?: string;
    paymentMethodCode?: string | null;
    publicKey?: string | null;
    [key: string]: unknown;
};

export type TransactionMethod = {
    id: number;
    code: string;
    name: string;
    methodType: TxnMethodType;
    sortOrder: number;
    promptPayId?: string | null;
    providerCode?: string | null;
    providerMethodCode?: string | null;
    checkoutFlow: string;
    metadata?: Record<string, unknown> | null;
};

export type TransactionSummary = {
    id: number;
    referenceCode: string;
    userId: number;
    companyId: number;
    paymentMethodId: number;
    txnType: TxnType;
    amount: number;
    status: TxnStatus;
    expiresAt: string | null;
    slipReference: string | null;
    slipDate: string | null;
    slipTimestamp: string | null;
    providerId?: number | null;
    providerReference?: string | null;
    providerStatus?: string | null;
    paymentAction?: PaymentAction | null;
    paidAt?: string | null;
    failedReason?: string | null;
    createdAt: string;
    updatedAt: string;
    method: TransactionMethod | null;
    orderId: number | null;
    isExpired: boolean;
};

export type OrderItem = {
    id: number;
    productId: number | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    addOns: CartAddOn[];
    lineTotal: number;
};

export type Order = {
    id: number;
    referenceCode: string;
    userId: number;
    branchId: number;
    transactionId: number;
    status: OrderStatus;
    fulfillmentMode: "pickup" | "rider_delivery" | string;
    deliveryFee: number;
    customerNote?: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    deliveryDistanceKm: number | null;
    createdAt: string;
    updatedAt: string;
    items: OrderItem[];
    branch: BranchSummary | null;
    transaction: TransactionSummary | null;
    deliveryJob?: DeliveryJob | null;
    totalAmount: number;
};

export type TransactionDetail = {
    transaction: TransactionSummary;
    order: Order | null;
    user?: UserRecord | null;
};

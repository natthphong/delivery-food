export type TxnStatus = "pending" | "accepted" | "rejected";
export type TxnType = "deposit" | "payment";
export type TxnMethodType = "qr" | "balance";

export type TransactionMethod = {
    id: number;
    code: string;
    name: string;
    type: TxnMethodType;
    details: any | null;
};

export type TransactionRow = {
    id: number;
    company_id: number;
    user_id: number | null;
    txn_type: TxnType;
    txn_method_id: number | null;
    reversal: boolean;
    amount: number;
    adjust_amount: number;
    status: TxnStatus;
    trans_ref: string | null;
    trans_date: string | null;
    trans_timestamp: string | null;
    expired_at: string | null;
    created_at: string;
    updated_at: string;
};

export type OrderStatus = "PENDING" | "PREPARE" | "DELIVERY" | "COMPLETED" | "REJECTED";

export type OrderDetails = {
    userId: number;
    branchId: string;
    branchName: string;
    productList: Array<{
        qty: number;
        price: number;
        productId: string;
        productName: string;
        productAddOns: Array<{ name: string; price: number }>;
    }>;
    delivery?: { lat: number; lng: number; distanceKm: number | null } | null;
    branchLat?: number | null;
    branchLng?: number | null;
};

export type OrderRow = {
    id: number;
    branch_id: number;
    txn_id: number | null;
    order_details: OrderDetails;
    status: OrderStatus;
    created_at: string;
    updated_at: string;
};

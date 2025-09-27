export type CartAddOn = {
    name: string;
    price: number;
};

export type CartItem = {
    productId: string;
    productName: string;
    qty: number;
    price: number;
    productAddOns: CartAddOn[];
};

export type CartBranchGroup = {
    branchId: string;
    companyId: string;
    branchName: string;
    productList: CartItem[];
    branchImage?: string | null;
    branchIsOpen?: boolean | null;
    branchLat?: number | null;
    branchLng?: number | null;
    openHours?: Record<string, [string, string][]> | null;
};

export type UserRecord = {
    id: number;
    firebase_uid: string;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean | null;
    is_phone_verified: boolean | null;
    balance: number;
    card: CartBranchGroup[];
    txn_history: number[];
    order_history: number[];
    created_at: string;
    updated_at: string;
};

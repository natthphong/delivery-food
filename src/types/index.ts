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
    branchImage: string | null;
    productList: CartItem[];
};

export type UserRecord = {
    id: number;
    firebase_uid: string;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean ;
    is_phone_verified: boolean ;
    card: CartBranchGroup[];
    created_at: string;
    updated_at: string;
};

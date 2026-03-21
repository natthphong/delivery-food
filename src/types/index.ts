export type UserRecord = {
    id: number;
    authProvider: string;
    email: string | null;
    phone: string | null;
    displayName: string | null;
    providerLabel: string | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    walletBalance: number;
    createdAt: string;
    updatedAt: string;
};

export type OperatingWindow = {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
};

export type Category = {
    id: number;
    companyId: number;
    slug: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
};

export type BranchSearchSample = {
    productId: number;
    name: string;
    imageUrl: string | null;
    price: number;
};

export type BranchSummary = {
    id: number;
    companyId: number;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    addressLine: string | null;
    lat: number | null;
    lng: number | null;
    isForceClosed: boolean;
    acceptingOrders: boolean;
    supportsPickup: boolean;
    supportsRiderDelivery: boolean;
    riderDeliveryFee: number;
    operationalNote: string | null;
    isOpen: boolean;
    openHours: OperatingWindow[];
};

export type BranchSearchResult = BranchSummary & {
    distanceKm: number | null;
    matchCount: number;
    productSample: BranchSearchSample[];
};

export type ProductAddOn = {
    id: number;
    groupName: string;
    name: string;
    price: number;
    isRequired: boolean;
    sortOrder: number;
};

export type MenuItem = {
    productId: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    basePrice: number;
    inStock: boolean;
    stockQty: number | null;
    isRecommended: boolean;
    isTemporarilyClosed: boolean;
    availabilityNote: string | null;
    reorderLevel: number | null;
    addOns: ProductAddOn[];
};

export type CartAddOn = {
    id?: number | null;
    name: string;
    price: number;
};

export type CartItem = {
    id: number;
    branchId: number;
    productId: number;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    stockQty: number | null;
    addOns: CartAddOn[];
    lineTotal: number;
    variantKey: string;
    createdAt: string;
    updatedAt: string;
};

export type CartBranchGroup = {
    branchId: number;
    companyId: number;
    branchName: string;
    branchImage: string | null;
    items: CartItem[];
    subTotal: number;
};

export type Cart = {
    groups: CartBranchGroup[];
    totalAmount: number;
    totalItems: number;
    totalQuantity: number;
    lastSyncedAt: string;
};

export type BootstrapPayload = {
    user: UserRecord;
    config: Record<string, string>;
    cart: Cart;
};

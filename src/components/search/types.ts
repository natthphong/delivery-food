export type Category = { id: number; name: string };

export type BranchSampleProduct = {
    id: number;
    name: string;
    price?: number;
    price_effective?: number;
    image_url?: string | null;
};

export type BranchItem = {
    id: number;
    name: string;
    image_url?: string | null;
    is_open: boolean;
    is_force_closed: boolean;
    distance_km?: number | null;
    products_sample?: BranchSampleProduct[];
    address_line?: string | null;
};

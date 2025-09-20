import { getSupabase } from "@utils/supabaseServer";

type BranchRow = {
    id: number;
    company_id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    address_line: string | null;
    lat: number | null;
    lng: number | null;
    open_hours: Record<string, [string, string][]> | null;
    is_force_closed: boolean;
};

type ProductRow = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    base_price: number | null;
    search_terms: string | null;
};

type ProductAddOnRow = {
    id: number;
    product_id: number;
    name: string;
    price: number | null;
    is_required: boolean;
    group_name: string | null;
};

export type BranchSearchProduct = {
    product_id: number;
    name: string | null;
    image_url: string | null;
    price: number | null;
};

export type BranchSearchResult = {
    branch_id: number;
    branch_name: string;
    image_url: string | null;
    lat: number | null;
    lng: number | null;
    address_line: string | null;
    is_force_closed: boolean;
    match_count: number;
    products_sample: BranchSearchProduct[];
};

export type BranchMenuItem = {
    product_id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: string;
    is_enabled: boolean;
    stock_qty: number | null;
    add_ons: Array<{
        id: number;
        name: string;
        price: number;
        is_required: boolean;
        group_name: string | null;
    }>;
};

export type BranchMenuPayload = {
    branch: BranchRow;
    menu: BranchMenuItem[];
};

function toNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

export async function searchBranches(params: {
    query?: string;
    categoryId?: number;
    limit?: number;
}): Promise<BranchSearchResult[]> {
    const supabase = getSupabase();
    const normalizedQuery = params.query?.trim().toLowerCase() || "";
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));

    let categoryProductIds: number[] | null = null;
    if (typeof params.categoryId === "number" && !Number.isNaN(params.categoryId)) {
        const { data, error } = await supabase
            .from("tbl_product_category")
            .select("product_id")
            .eq("category_id", params.categoryId);
        if (error) {
            throw new Error(error.message || "Failed to load product categories");
        }
        categoryProductIds = (data ?? []).map((row) => row.product_id);
        if (categoryProductIds.length === 0) {
            return [];
        }
    }

    let branchProductQuery = supabase
        .from("tbl_branch_product")
        .select("branch_id, product_id, is_enabled, stock_qty, price_override, search_terms")
        .eq("is_enabled", true);

    if (categoryProductIds) {
        branchProductQuery = branchProductQuery.in("product_id", categoryProductIds);
    }

    const { data: branchProductRows, error: branchProductError } = await branchProductQuery;
    if (branchProductError) {
        throw new Error(branchProductError.message || "Failed to load branch products");
    }

    if (!branchProductRows || branchProductRows.length === 0) {
        return [];
    }

    const productIds = Array.from(new Set(branchProductRows.map((row) => row.product_id)));
    if (!productIds.length) {
        return [];
    }

    const { data: productRows, error: productError } = await supabase
        .from("tbl_product")
        .select("id, name, description, image_url, base_price, search_terms")
        .in("id", productIds);
    if (productError) {
        throw new Error(productError.message || "Failed to load products");
    }

    const productMap = new Map<number, ProductRow>();
    for (const row of productRows ?? []) {
        productMap.set(row.id, row);
    }

    const filteredBranchProducts = normalizedQuery
        ? branchProductRows.filter((row) => {
              const product = productMap.get(row.product_id);
              const candidates = [product?.name, product?.search_terms, row.search_terms];
              return candidates.some((value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery));
          })
        : branchProductRows;

    if (!filteredBranchProducts.length) {
        return [];
    }

    const branchIds = Array.from(new Set(filteredBranchProducts.map((row) => row.branch_id)));
    if (!branchIds.length) {
        return [];
    }

    const { data: branchRows, error: branchError } = await supabase
        .from("tbl_branch")
        .select("id, company_id, name, description, image_url, address_line, lat, lng, open_hours, is_force_closed")
        .in("id", branchIds);
    if (branchError) {
        throw new Error(branchError.message || "Failed to load branches");
    }

    const branchMap = new Map<number, BranchRow>();
    for (const row of branchRows ?? []) {
        branchMap.set(row.id, {
            id: row.id,
            company_id: row.company_id,
            name: row.name,
            description: row.description ?? null,
            image_url: row.image_url ?? null,
            address_line: row.address_line ?? null,
            lat: row.lat ?? null,
            lng: row.lng ?? null,
            open_hours: row.open_hours ?? null,
            is_force_closed: !!row.is_force_closed,
        });
    }

    const byBranch = new Map<number, BranchSearchResult>();

    for (const row of filteredBranchProducts) {
        const branch = branchMap.get(row.branch_id);
        const product = productMap.get(row.product_id);
        if (!branch || !product) continue;

        const existing = byBranch.get(row.branch_id);
        const sampleItem: BranchSearchProduct = {
            product_id: product.id,
            name: product.name ?? null,
            image_url: product.image_url ?? null,
            price: toNumber(row.price_override ?? product.base_price ?? null),
        };

        if (!existing) {
            byBranch.set(row.branch_id, {
                branch_id: branch.id,
                branch_name: branch.name,
                image_url: branch.image_url,
                lat: branch.lat,
                lng: branch.lng,
                address_line: branch.address_line,
                is_force_closed: branch.is_force_closed,
                match_count: 1,
                products_sample: [sampleItem],
            });
        } else {
            existing.products_sample.push(sampleItem);
            existing.match_count += 1;
        }
    }

    const results: BranchSearchResult[] = Array.from(byBranch.values()).map((entry) => {
        const seen = new Map<number, BranchSearchProduct>();
        for (const item of entry.products_sample) {
            if (!seen.has(item.product_id)) {
                seen.set(item.product_id, item);
            }
        }
        const deduped = Array.from(seen.values()).sort((a, b) => a.product_id - b.product_id);
        return {
            ...entry,
            match_count: deduped.length,
            products_sample: deduped,
        };
    });

    results.sort((a, b) => b.match_count - a.match_count);

    return results.slice(0, limit);
}

export async function getBranchMenu(branchId: number): Promise<BranchMenuPayload | null> {
    const supabase = getSupabase();

    const { data: branchRow, error: branchError } = await supabase
        .from("tbl_branch")
        .select("id, company_id, name, description, image_url, address_line, lat, lng, open_hours, is_force_closed")
        .eq("id", branchId)
        .maybeSingle();

    if (branchError) {
        throw new Error(branchError.message || "Failed to load branch");
    }

    if (!branchRow) {
        return null;
    }

    const { data: branchProducts, error: branchProductsError } = await supabase
        .from("tbl_branch_product")
        .select("product_id, is_enabled, stock_qty, price_override")
        .eq("branch_id", branchId);

    if (branchProductsError) {
        throw new Error(branchProductsError.message || "Failed to load branch menu");
    }

    const productIds = Array.from(new Set((branchProducts ?? []).map((row) => row.product_id)));
    const hasProducts = productIds.length > 0;

    const { data: productRows, error: productError } = hasProducts
        ? await supabase
              .from("tbl_product")
              .select("id, name, description, image_url, base_price")
              .in("id", productIds)
        : { data: [] as ProductRow[], error: null };

    if (productError) {
        throw new Error(productError.message || "Failed to load products");
    }

    const productMap = new Map<number, ProductRow>();
    for (const row of productRows ?? []) {
        productMap.set(row.id, row);
    }

    const { data: addOnRows, error: addOnError } = hasProducts
        ? await supabase
              .from("tbl_product_add_on")
              .select("id, product_id, name, price, is_required, group_name")
              .in("product_id", productIds)
        : { data: [] as ProductAddOnRow[], error: null };

    if (addOnError) {
        throw new Error(addOnError.message || "Failed to load product add-ons");
    }

    const addOnMap = new Map<number, ProductAddOnRow[]>();
    for (const addOn of addOnRows ?? []) {
        const arr = addOnMap.get(addOn.product_id) ?? [];
        arr.push(addOn);
        addOnMap.set(addOn.product_id, arr);
    }

    const menu: BranchMenuItem[] = (branchProducts ?? [])
        .map((row) => {
            const product = productMap.get(row.product_id);
            if (!product) return null;

            const basePrice = toNumber(product.base_price);
            const overridePrice = toNumber(row.price_override);
            const effective = overridePrice ?? basePrice ?? 0;
            const addOns = (addOnMap.get(product.id) ?? []).map((addOn) => ({
                id: addOn.id,
                name: addOn.name,
                price: toNumber(addOn.price) ?? 0,
                is_required: !!addOn.is_required,
                group_name: addOn.group_name ?? null,
            }));

            addOns.sort((a, b) => a.id - b.id);

            return {
                product_id: product.id,
                name: product.name,
                description: product.description ?? null,
                image_url: product.image_url ?? null,
                price: effective.toFixed(2),
                is_enabled: !!row.is_enabled,
                stock_qty: row.stock_qty ?? null,
                add_ons: addOns,
            };
        })
        .filter((item): item is BranchMenuItem => Boolean(item));

    menu.sort((a, b) => a.product_id - b.product_id);

    const branch: BranchRow = {
        id: branchRow.id,
        company_id: branchRow.company_id,
        name: branchRow.name,
        description: branchRow.description ?? null,
        image_url: branchRow.image_url ?? null,
        address_line: branchRow.address_line ?? null,
        lat: branchRow.lat ?? null,
        lng: branchRow.lng ?? null,
        open_hours: branchRow.open_hours ?? null,
        is_force_closed: !!branchRow.is_force_closed,
    };

    return { branch, menu };
}

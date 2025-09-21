// src/repository/branch.ts
import { getSupabase } from "@utils/supabaseServer";

/* ============================== Types ============================== */

export type BranchRow = {
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

export type ProductRow = {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    base_price: number | null; // numeric → number
    search_terms?: string | null;
};

export type ProductAddOnRow = {
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
    price: string; // "12.34"
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
    page?: number;
    size?: number;
    total?: number;
};

/* ============================== Helpers ============================== */

function toNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

/** Escape % and _ for ILIKE patterns */
function escapeIlike(input: string): string {
    return input.replace(/[%_]/g, (m) => `\\${m}`);
}

async function getBranchById(branchId: number): Promise<BranchRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_branch")
        .select(
            "id, company_id, name, description, image_url, address_line, lat, lng, open_hours, is_force_closed"
        )
        .eq("id", branchId)
        .maybeSingle();

    if (error) throw new Error(error.message || "Failed to load branch");
    if (!data) return null;

    return {
        id: data.id,
        company_id: data.company_id,
        name: data.name,
        description: data.description ?? null,
        image_url: data.image_url ?? null,
        address_line: data.address_line ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        open_hours: data.open_hours ?? null,
        is_force_closed: !!data.is_force_closed,
    };
}

async function loadAddOns(productIds: number[]): Promise<Map<number, ProductAddOnRow[]>> {
    const supabase = getSupabase();
    if (productIds.length === 0) return new Map();

    const { data, error } = await supabase
        .from("tbl_product_add_on")
        .select("id, product_id, name, price, is_required, group_name")
        .in("product_id", productIds);

    if (error) throw new Error(error.message || "Failed to load product add-ons");

    const map = new Map<number, ProductAddOnRow[]>();
    for (const row of data ?? []) {
        const list = map.get(row.product_id) ?? [];
        list.push(row as ProductAddOnRow);
        map.set(row.product_id, list);
    }
    return map;
}

/* ============================== Search (kept) ============================== */

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
        if (error) throw new Error(error.message || "Failed to load product categories");
        categoryProductIds = (data ?? []).map((row) => row.product_id);
        if (categoryProductIds.length === 0) return [];
    }

    let branchProductQuery = supabase
        .from("tbl_branch_product")
        .select("branch_id, product_id, is_enabled, stock_qty, price_override, search_terms")
        .eq("is_enabled", true);

    if (categoryProductIds) {
        branchProductQuery = branchProductQuery.in("product_id", categoryProductIds);
    }

    const { data: branchProductRows, error: branchProductError } = await branchProductQuery;
    if (branchProductError) throw new Error(branchProductError.message || "Failed to load branch products");
    if (!branchProductRows || branchProductRows.length === 0) return [];

    const productIds = Array.from(new Set(branchProductRows.map((row) => row.product_id)));
    if (!productIds.length) return [];

    const { data: productRows, error: productError } = await supabase
        .from("tbl_product")
        .select("id, name, description, image_url, base_price, search_terms")
        .in("id", productIds);
    if (productError) throw new Error(productError.message || "Failed to load products");

    const productMap = new Map<number, ProductRow>();
    for (const row of productRows ?? []) {
        productMap.set(row.id, row as ProductRow);
    }

    const filteredBranchProducts = normalizedQuery
        ? branchProductRows.filter((row) => {
            const product = productMap.get(row.product_id);
            const candidates = [product?.name, product?.search_terms as any, row.search_terms];
            return candidates.some(
                (value) => typeof value === "string" && value.toLowerCase().includes(normalizedQuery)
            );
        })
        : branchProductRows;

    if (!filteredBranchProducts.length) return [];

    const branchIds = Array.from(new Set(filteredBranchProducts.map((row) => row.branch_id)));
    if (!branchIds.length) return [];

    const { data: branchRows, error: branchError } = await supabase
        .from("tbl_branch")
        .select(
            "id, company_id, name, description, image_url, address_line, lat, lng, open_hours, is_force_closed"
        )
        .in("id", branchIds);
    if (branchError) throw new Error(branchError.message || "Failed to load branches");

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

/* ============================== Menu with search + pagination ============================== */

export async function getBranchMenu(
    branchId: number,
    opts?: { searchBy?: string; page?: number; size?: number }
): Promise<BranchMenuPayload | null> {
    const supabase = getSupabase();

    // 1) branch header
    const branch = await getBranchById(branchId);
    if (!branch) return null;

    // 2) base query
    const page = Math.max(1, Number(opts?.page || 1));
    const size = Math.min(100, Math.max(1, Number(opts?.size || 20)));
    const from = (page - 1) * size;
    const to = from + size - 1;

    let query = supabase
        .from("tbl_branch_product")
        .select(
            "product:tbl_product!inner(id,name,description,image_url,base_price), product_id, is_enabled, stock_qty, price_override",
            { count: "exact" }
        )
        .eq("branch_id", branchId);

    const searchBy = (opts?.searchBy || "").trim();
    if (searchBy) {
        const pattern = `%${escapeIlike(searchBy)}%`;
        // IMPORTANT: Use unqualified columns and target the foreign table explicitly
        query = query.or(
            `name.ilike.${pattern},description.ilike.${pattern}`,
            { foreignTable: "tbl_product" } // 👈 key fix
        );
    }

    const { data, error, count } = await query
        .order("product_id", { ascending: true, nullsFirst: false })
        .range(from, to);

    if (error) throw new Error(error.message || "Failed to load branch menu");

    type RowShape = {
        product: ProductRow;
        product_id: number;
        is_enabled: boolean;
        stock_qty: number | null;
        price_override: number | null;
    };

    const pageRows: RowShape[] =
        (data ?? []).map((r: any) => ({
            product: r.product as ProductRow,
            product_id: r.product_id as number,
            is_enabled: !!r.is_enabled,
            stock_qty: r.stock_qty ?? null,
            price_override: toNumber(r.price_override),
        })) ?? [];

    const productIds = pageRows.map((r) => r.product.id);
    const addOnMap = await loadAddOns(productIds);

    const menu: BranchMenuItem[] = pageRows.map((row) => {
        const p = row.product;
        const basePrice = toNumber(p.base_price);
        const overridePrice = toNumber(row.price_override);
        const effective = (overridePrice ?? basePrice ?? 0).toFixed(2);

        const addOns =
            (addOnMap.get(p.id) ?? [])
                .map((a) => ({
                    id: a.id,
                    name: a.name,
                    price: toNumber(a.price) ?? 0,
                    is_required: !!a.is_required,
                    group_name: a.group_name ?? null,
                }))
                .sort((a, b) => a.id - b.id);

        return {
            product_id: p.id,
            name: p.name,
            description: p.description ?? null,
            image_url: p.image_url ?? null,
            price: effective,
            is_enabled: row.is_enabled,
            stock_qty: row.stock_qty,
            add_ons: addOns,
        };
    });

    menu.sort((a, b) => a.product_id - b.product_id);

    return {
        branch,
        menu,
        page,
        size,
        total: count ?? menu.length,
    };
}

/* ============================== Top menu (recommend first, then newest) ============================== */

export async function getTopMenu(branchId: number): Promise<BranchMenuPayload | null> {
    const supabase = getSupabase();

    const branch = await getBranchById(branchId);
    if (!branch) return null;

    const { data, error } = await supabase
        .from("tbl_branch_product")
        .select(
            "product:tbl_product!inner(id,name,description,image_url,base_price), is_enabled, stock_qty, price_override, updated_at, recommend_menu"
        )
        .eq("branch_id", branchId)
        .order("recommend_menu", { ascending: false, nullsFirst: false }) // true first
        .order("updated_at", { ascending: false, nullsFirst: false })     // newest first
        .limit(10);

    if (error) throw new Error(error.message || "Failed to load top menu");

    type RowShape = {
        product: ProductRow;
        is_enabled: boolean;
        stock_qty: number | null;
        price_override: number | null;
    };

    const rows: RowShape[] =
        (data ?? []).map((r: any) => ({
            product: r.product as ProductRow,
            is_enabled: !!r.is_enabled,
            stock_qty: r.stock_qty ?? null,
            price_override: toNumber(r.price_override),
        })) ?? [];

    const productIds = rows.map((r) => r.product.id);
    const addOnMap = await loadAddOns(productIds);

    const menu: BranchMenuItem[] = rows.map((row) => {
        const p = row.product;
        const basePrice = toNumber(p.base_price);
        const overridePrice = toNumber(row.price_override);
        const effective = (overridePrice ?? basePrice ?? 0).toFixed(2);

        const addOns =
            (addOnMap.get(p.id) ?? [])
                .map((a) => ({
                    id: a.id,
                    name: a.name,
                    price: toNumber(a.price) ?? 0,
                    is_required: !!a.is_required,
                    group_name: a.group_name ?? null,
                }))
                .sort((a, b) => a.id - b.id);

        return {
            product_id: p.id,
            name: p.name,
            description: p.description ?? null,
            image_url: p.image_url ?? null,
            price: effective,
            is_enabled: row.is_enabled,
            stock_qty: row.stock_qty,
            add_ons: addOns,
        };
    });

    return { branch, menu };
}

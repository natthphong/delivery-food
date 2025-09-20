import { sql } from "@/utils/db";

export type BranchSearchParams = {
    q?: string;
    categoryId?: number;
    lat?: number;
    lng?: number;
    limit?: number;
};

export type BranchSearchProduct = {
    product_id: number;
    name: string;
    image_url: string | null;
    price: string;
};

export type BranchSearchResult = {
    branch_id: number;
    branch_name: string;
    image_url: string | null;
    lat: number | null;
    lng: number | null;
    address_line: string | null;
    is_force_closed: boolean;
    distance_m: number | null;
    match_count: number;
    products_sample: BranchSearchProduct[];
};

export async function searchBranches(params: BranchSearchParams): Promise<BranchSearchResult[]> {
    const searchTerm = (params.q || "").trim();
    const categoryFilterId = Number.isFinite(params.categoryId) ? Number(params.categoryId) : null;
    const limitValue = Number.isFinite(params.limit) ? Math.max(1, Math.min(Number(params.limit), 50)) : 20;
    const latValue = Number.isFinite(params.lat) ? Number(params.lat) : null;
    const lngValue = Number.isFinite(params.lng) ? Number(params.lng) : null;
    const hasGeo = latValue !== null && lngValue !== null;

    const searchFilter = searchTerm
        ? sql`
              AND (
                  p.search_tsv @@ plainto_tsquery('simple', ${searchTerm})
                  OR p.name ILIKE ${`%${searchTerm}%`}
                  OR COALESCE(p.search_terms, '') ILIKE ${`%${searchTerm}%`}
                  OR COALESCE(bp.search_terms, '') ILIKE ${`%${searchTerm}%`}
                  OR bp.search_tsv @@ plainto_tsquery('simple', ${searchTerm})
              )
          `
        : sql``;

    const categoryFilter = categoryFilterId !== null
        ? sql`
              AND EXISTS (
                  SELECT 1
                  FROM delivery_app.tbl_product_category pc
                  WHERE pc.product_id = p.id AND pc.category_id = ${categoryFilterId}
              )
          `
        : sql``;

    const distanceSelect = hasGeo
        ? sql`
              (6371000 * 2 * ASIN(SQRT(
                  POWER(SIN(RADIANS(ABS(b.lat - ${latValue}) / 2)), 2) +
                  COS(RADIANS(b.lat)) * COS(RADIANS(${latValue})) *
                  POWER(SIN(RADIANS(ABS(b.lng - ${lngValue}) / 2)), 2)
              )))::float AS distance_m
          `
        : sql`NULL::float AS distance_m`;

    const distanceOrder = hasGeo ? sql`, distance_m ASC` : sql``;

    const result = await sql<{
        branch_id: number;
        branch_name: string;
        image_url: string | null;
        lat: number | null;
        lng: number | null;
        address_line: string | null;
        is_force_closed: boolean;
        distance_m: number | string | null;
        match_count: number | string;
        products_sample: BranchSearchProduct[] | null;
    }>`
        WITH matches AS (
            SELECT
                b.id AS branch_id,
                b.name AS branch_name,
                b.image_url,
                b.lat,
                b.lng,
                b.address_line,
                b.is_force_closed,
                ${distanceSelect},
                COUNT(DISTINCT p.id) AS match_count,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'product_id', p.id,
                            'name', p.name,
                            'image_url', p.image_url,
                            'price', COALESCE(bp.price_override, p.base_price)
                        )
                        ORDER BY p.id
                    ) FILTER (WHERE bp.is_enabled),
                    '[]'::json
                ) AS products_sample
            FROM delivery_app.tbl_branch b
            JOIN delivery_app.tbl_branch_product bp ON bp.branch_id = b.id
            JOIN delivery_app.tbl_product p ON p.id = bp.product_id
            WHERE bp.is_enabled = TRUE
            ${searchFilter}
            ${categoryFilter}
            GROUP BY b.id, b.name, b.image_url, b.lat, b.lng, b.address_line, b.is_force_closed
        )
        SELECT
            branch_id,
            branch_name,
            image_url,
            lat,
            lng,
            address_line,
            is_force_closed,
            distance_m,
            match_count,
            products_sample
        FROM matches
        ORDER BY match_count DESC${distanceOrder}
        LIMIT ${limitValue};
    `;

    return result.rows.map((row) => ({
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        image_url: row.image_url,
        lat: row.lat === null ? null : Number(row.lat),
        lng: row.lng === null ? null : Number(row.lng),
        address_line: row.address_line,
        is_force_closed: row.is_force_closed,
        distance_m: row.distance_m === null ? null : Number(row.distance_m),
        match_count: typeof row.match_count === "number" ? row.match_count : Number(row.match_count || 0),
        products_sample: Array.isArray(row.products_sample)
            ? row.products_sample.map((product) => ({
                  product_id: product.product_id,
                  name: product.name,
                  image_url: product.image_url ?? null,
                  price: String(product.price),
              }))
            : [],
    }));
}

export type BranchRecord = {
    id: number;
    company_id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    address_line: string | null;
    lat: number | null;
    lng: number | null;
    open_hours: unknown;
    is_force_closed: boolean;
};

export type ProductAddOn = {
    id: number;
    name: string;
    price: string;
    is_required: boolean;
    group_name: string | null;
};

export type BranchMenuProduct = {
    product_id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    price: string;
    is_enabled: boolean;
    stock_qty: number | null;
    add_ons: ProductAddOn[];
};

export type BranchMenuResult = {
    branch: BranchRecord;
    menu: BranchMenuProduct[];
};

export async function getBranchMenu(branchId: number): Promise<BranchMenuResult | null> {
    const branchResult = await sql<BranchRecord>`
        SELECT
            id,
            company_id,
            name,
            description,
            image_url,
            address_line,
            lat,
            lng,
            open_hours,
            is_force_closed
        FROM delivery_app.tbl_branch
        WHERE id = ${branchId};
    `;

    const branch = branchResult.rows[0];
    if (!branch) {
        return null;
    }

    const normalizedBranch: BranchRecord = {
        ...branch,
        lat: branch.lat === null ? null : Number(branch.lat),
        lng: branch.lng === null ? null : Number(branch.lng),
    };

    const menuResult = await sql<{
        product_id: number;
        name: string;
        description: string | null;
        image_url: string | null;
        price: string | number;
        is_enabled: boolean;
        stock_qty: number | string | null;
        add_ons: ProductAddOn[] | null;
    }>`
        SELECT
            p.id AS product_id,
            p.name,
            p.description,
            p.image_url,
            COALESCE(bp.price_override, p.base_price) AS price,
            bp.is_enabled,
            bp.stock_qty,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', a.id,
                        'name', a.name,
                        'price', a.price,
                        'is_required', a.is_required,
                        'group_name', a.group_name
                    )
                    ORDER BY a.id
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'::json
            ) AS add_ons
        FROM delivery_app.tbl_branch_product bp
        JOIN delivery_app.tbl_product p ON p.id = bp.product_id
        LEFT JOIN delivery_app.tbl_product_add_on a ON a.product_id = p.id
        WHERE bp.branch_id = ${branchId} AND bp.is_enabled = TRUE
        GROUP BY p.id, p.name, p.description, p.image_url, bp.price_override, p.base_price, bp.is_enabled, bp.stock_qty
        ORDER BY p.name;
    `;

    const menu = menuResult.rows.map((row) => ({
        product_id: row.product_id,
        name: row.name,
        description: row.description,
        image_url: row.image_url,
        price: String(row.price),
        is_enabled: row.is_enabled,
        stock_qty: row.stock_qty === null ? null : Number(row.stock_qty),
        add_ons: Array.isArray(row.add_ons)
            ? row.add_ons.map((addOn) => ({
                  id: addOn.id,
                  name: addOn.name,
                  price: String(addOn.price),
                  is_required: addOn.is_required,
                  group_name: addOn.group_name ?? null,
              }))
            : [],
    }));

    return { branch: normalizedBranch, menu };
}

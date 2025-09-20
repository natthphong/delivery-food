import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/utils/db";
import { logError } from "@/utils/logger";

/**
 * GET /api/search?q=กระเพรา&categoryId=2&lat=13.74&lng=100.53&limit=20
 * Returns branches with match_count, distance (if lat/lng provided), and sample products
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }
        const { q = "", categoryId, lat, lng, limit = "20" } = req.query as Record<string, string>;
        const qText = (q || "").trim();
        const hasGeo = !!lat && !!lng;

        // Build where conditions (FTS + fallback ILIKE)
        const whereParts: string[] = [];
        const params: any[] = [];
        let p = 1;

        if (qText) {
            whereParts.push(`(
        p.search_tsv @@ plainto_tsquery('simple', $${p})
        OR p.name ILIKE '%' || $${p} || '%'
        OR coalesce(p.search_terms,'') ILIKE '%' || $${p} || '%'
        OR coalesce(bp.search_terms,'') ILIKE '%' || $${p} || '%'
        OR bp.search_tsv @@ plainto_tsquery('simple', $${p})
      )`);
            params.push(qText); p++;
        }

        if (categoryId) {
            whereParts.push(`EXISTS (
        SELECT 1 FROM tbl_product_category pc
        WHERE pc.product_id = p.id AND pc.category_id = $${p}
      )`);
            params.push(Number(categoryId)); p++;
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

        // Distance expression
        let selectDistance = `NULL::float as distance_m`;
        let orderDistance = ``;
        if (hasGeo) {
            params.push(Number(lat), Number(lng)); const latIdx = p++, lngIdx = p++;
            // Haversine (in meters), avoids requiring PostGIS
            selectDistance = `
        (6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(ABS(b.lat - $${latIdx})/2)),2) +
          COS(RADIANS(b.lat)) * COS(RADIANS($${latIdx})) *
          POWER(SIN(RADIANS(ABS(b.lng - $${lngIdx})/2)),2)
        ))) as distance_m
      `;
            orderDistance = `, distance_m ASC`;
        }

        params.push(Number(limit)); const limIdx = p++;

        const sql = `
      WITH matches AS (
        SELECT
          b.id AS branch_id,
          b.name AS branch_name,
          b.image_url,
          b.lat, b.lng, b.address_line,
          b.is_force_closed,
          ${selectDistance},
          COUNT(DISTINCT p.id) AS match_count,
          -- sample top matches
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'product_id', p.id,
              'name', p.name,
              'image_url', p.image_url,
              'price', COALESCE(bp.price_override, p.base_price)
            )
            ORDER BY p.id
          ) FILTER (WHERE bp.is_enabled) AS products_sample
        FROM tbl_branch b
        JOIN tbl_branch_product bp ON bp.branch_id = b.id AND bp.is_enabled = TRUE
        JOIN tbl_product p ON p.id = bp.product_id
        ${whereSql}
        GROUP BY b.id
      )
      SELECT * FROM matches
      ORDER BY match_count DESC ${orderDistance}
      LIMIT $${limIdx};
    `;

        const { rows } = await db.query(sql, params);
        return res.status(200).json({ code: "OK", message: "success", body: rows });
    } catch (e: any) {
        logError("search API error", { message: e?.message, stack: e?.stack });
        return res.status(500).json({ code: "INTERNAL_ERROR", message: e?.message || "Search failed", body: null });
    }
}

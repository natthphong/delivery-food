import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/utils/db";
export const config = { runtime: 'nodejs' }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        const { id } = req.query as { id: string };
        const branchId = Number(id);
        if (!branchId) return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid branch id", body: null });

        const branchSql = `SELECT id, company_id, name, description, image_url, address_line, lat, lng, open_hours, is_force_closed FROM tbl_branch WHERE id = $1`;
        const branch = (await db.query(branchSql, [branchId])).rows[0];
        if (!branch) return res.status(404).json({ code: "NOT_FOUND", message: "Branch not found", body: null });

        // Menu with effective price and add-ons
        const menuSql = `
      SELECT
        p.id as product_id, p.name, p.description, p.image_url,
        COALESCE(bp.price_override, p.base_price) AS price,
        bp.is_enabled, bp.stock_qty,
        COALESCE(
          JSON_AGG(JSON_BUILD_OBJECT('id', a.id, 'name', a.name, 'price', a.price, 'is_required', a.is_required, 'group_name', a.group_name)
          ORDER BY a.id) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) AS add_ons
      FROM tbl_branch_product bp
      JOIN tbl_product p ON p.id = bp.product_id
      LEFT JOIN tbl_product_add_on a ON a.product_id = p.id
      WHERE bp.branch_id = $1
      GROUP BY p.id, bp.is_enabled, bp.stock_qty, bp.price_override, p.base_price;
    `;
        const { rows } = await db.query(menuSql, [branchId]);

        return res.status(200).json({
            code: "OK",
            message: "success",
            body: { branch, menu: rows }
        });
    } catch (e: any) {
        return res.status(500).json({ code: "INTERNAL_ERROR", message: e?.message || "Menu failed", body: null });
    }
}

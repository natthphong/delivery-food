import type { NextApiRequest, NextApiResponse } from "next";
import { getBranchMenu } from "@repository/branch";
import { logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        res.setHeader("Cache-Control", "public, s-maxage=1, stale-while-revalidate=59");

        const { id } = req.query as { id?: string };
        const branchId = id ? Number(id) : NaN;
        if (!Number.isFinite(branchId) || branchId <= 0) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid branch id", body: null });
        }

        const payload = await getBranchMenu(branchId);
        if (!payload) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Branch not found", body: null });
        }

        return res.status(200).json({ code: "OK", message: "success", body: payload });
    } catch (e: any) {
        logError("branch menu API error", { message: e?.message, stack: e?.stack });
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Menu failed", body: null });
    }
}

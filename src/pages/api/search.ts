export const config = { runtime: 'nodejs' }
import type { NextApiRequest, NextApiResponse } from "next";
import { searchBranches } from "@/repository/branch";
import { logError } from "@/utils/logger";

function firstQueryValue(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

function parseOptionalNumber(value: string | string[] | undefined) {
    const raw = firstQueryValue(value);
    if (raw === undefined || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
    }

    try {
        const { q, categoryId, lat, lng, limit } = req.query;

        const qText = (firstQueryValue(q) || "").trim();
        const categoryNumber = parseOptionalNumber(categoryId);
        if (categoryNumber !== null && Number.isNaN(categoryNumber)) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid categoryId", body: null });
        }

        const latNumber = parseOptionalNumber(lat);
        const lngNumber = parseOptionalNumber(lng);
        if ((latNumber !== null && Number.isNaN(latNumber)) || (lngNumber !== null && Number.isNaN(lngNumber))) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid coordinates", body: null });
        }

        const limitNumber = parseOptionalNumber(limit);
        if (limitNumber !== null && Number.isNaN(limitNumber)) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid limit", body: null });
        }

        const branches = await searchBranches({
            q: qText,
            categoryId: categoryNumber === null ? undefined : categoryNumber,
            lat: latNumber === null ? undefined : latNumber,
            lng: lngNumber === null ? undefined : lngNumber,
            limit: limitNumber === null ? undefined : limitNumber,
        });

        return res.status(200).json({ code: "OK", message: "success", body: branches });
    } catch (error: any) {
        logError("search API error", {
            message: error?.message,
            code: error?.code,
        });
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Search failed", body: null });
    }
}

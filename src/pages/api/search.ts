import type { NextApiRequest, NextApiResponse } from "next";
import { searchBranches } from "@repository/branch";
import { logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

function parseNumber(input: string | string[] | undefined): number | null {
    if (Array.isArray(input)) return parseNumber(input[0]);
    if (typeof input !== "string" || input.trim() === "") return null;
    const num = Number(input);
    return Number.isFinite(num) ? num : null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        const { q = "", categoryId, lat, lng, limit } = req.query;
        const category = parseNumber(categoryId);
        const limitNum = parseNumber(limit);
        const latNum = parseNumber(lat);
        const lngNum = parseNumber(lng);
        const hasGeo = latNum !== null && lngNum !== null;

        const results = await searchBranches({
            query: typeof q === "string" ? q : Array.isArray(q) ? q[0] : "",
            categoryId: category ?? undefined,
            limit: limitNum ?? undefined,
        });

        const enriched = results.map((branch) => {
            if (!hasGeo || typeof branch.lat !== "number" || typeof branch.lng !== "number") {
                return { ...branch, distance_m: null };
            }
            return {
                ...branch,
                distance_m: haversineDistance(latNum!, lngNum!, branch.lat, branch.lng),
            };
        });

        const body = hasGeo
            ? [...enriched].sort((a, b) => {
                  const distA = typeof a.distance_m === "number" ? a.distance_m : Number.POSITIVE_INFINITY;
                  const distB = typeof b.distance_m === "number" ? b.distance_m : Number.POSITIVE_INFINITY;
                  if (distA === distB) {
                      return (b.match_count ?? 0) - (a.match_count ?? 0);
                  }
                  return distA - distB;
              })
            : enriched;

        return res.status(200).json({ code: "OK", message: "success", body });
    } catch (e: any) {
        logError("search API error", { message: e?.message, stack: e?.stack });
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Search failed", body: null });
    }
}

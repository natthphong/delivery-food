import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getBranchSummaries } from "@/repository/branch";
import { isBranchOpen } from "@/utils/branchOpen";

const RESPONSE_OK = { code: "OK", message: "success" } as const;

export type BranchSummaryResponse = {
    code: string;
    message: string;
    body: {
        branches: Array<{
            id: number;
            name: string;
            address: string | null;
            image_url: string | null;
            lat: number | null;
            lng: number | null;
            branchIsOpen: boolean;
            openHours: Record<string, [string, string][]> | null;
        }>;
    };
};

async function handler(req: NextApiRequest, res: NextApiResponse<BranchSummaryResponse>) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { branches: [] } });
    }

    res.setHeader("Cache-Control", "no-store");

    const auth = (req as any).auth;
    if (!auth?.uid) {
        const unauthorized: BranchSummaryResponse = {
            code: "UNAUTHORIZED",
            message: "Missing token",
            body: { branches: [] },
        };
        return res.status(401).json(unauthorized);
    }

    const idsParam = req.query.ids;
    const ids = (Array.isArray(idsParam) ? idsParam : typeof idsParam === "string" ? idsParam.split(",") : [])
        .map((value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        })
        .filter((value): value is number => value != null);

    if (ids.length === 0) {
        return res.status(200).json({ ...RESPONSE_OK, body: { branches: [] } });
    }

    try {
        const branches = await getBranchSummaries(ids);
        const payload = branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
            address: branch.address_line,
            image_url: branch.image_url ?? null,
            lat: branch.lat ?? null,
            lng: branch.lng ?? null,
            branchIsOpen: isBranchOpen({
                isForceClosed: !!branch.is_force_closed,
                openHours: branch.open_hours,
            }),
            openHours: branch.open_hours ?? null,
        }));
        return res.status(200).json({ ...RESPONSE_OK, body: { branches: payload } });
    } catch (error: any) {
        return res
            .status(500)
            .json({ code: "ERROR", message: error?.message || "Failed to load branches", body: { branches: [] } });
    }
}

export default withAuth(handler);

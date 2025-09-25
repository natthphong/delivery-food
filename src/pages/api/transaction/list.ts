import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionsByIds } from "@/repository/transaction";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionRow } from "@/types/transaction";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type ListResponse = JsonResponse<{ transactions: TransactionRow[] }>;

function parseIds(value: unknown): number[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === "number" && Number.isFinite(item)) return item;
                if (typeof item === "string" && item.trim()) {
                    const num = Number(item);
                    return Number.isFinite(num) ? num : null;
                }
                return null;
            })
            .filter((id): id is number => id != null);
    }
    if (typeof value === "string" && value.trim()) {
        return value
            .split(",")
            .map((piece) => {
                const num = Number(piece.trim());
                return Number.isFinite(num) ? num : null;
            })
            .filter((id): id is number => id != null);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return [value];
    }
    return [];
}

async function handler(req: NextApiRequest, res: NextApiResponse<ListResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { transactions: [] } });
        }

        res.setHeader("Cache-Control", "no-store");

        const ids = parseIds(req.query.ids);
        logInfo("transaction list: request", { reqId, count: ids.length });

        const transactions = await getTransactionsByIds(ids);

        return res.status(200).json({ code: "OK", message: "success", body: { transactions } });
    } catch (error: any) {
        logError("transaction list: error", { reqId, message: error?.message });
        return res
            .status(500)
            .json({ code: "ERROR", message: "Failed to load transactions", body: { transactions: [] } });
    }
}

export default withAuth(handler);

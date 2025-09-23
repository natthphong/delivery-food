import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getOrderByTxnId } from "@/repository/order";
import { logError, logInfo } from "@/utils/logger";
import type { OrderRow } from "@/types/transaction";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type ResponseBody = JsonResponse<{ order: OrderRow | null }>;

function parseTxnId(value: unknown): number | null {
    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseBody>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { order: null } });
        }

        res.setHeader("Cache-Control", "no-store");

        const txnId = parseTxnId(req.query.txnId);
        if (txnId == null) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid txnId", body: { order: null } });
        }

        logInfo("order by txn: request", { reqId, txnId });

        const order = await getOrderByTxnId(txnId);

        if (!order) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Order not found", body: { order: null } });
        }

        return res.status(200).json({ code: "OK", message: "success", body: { order } });
    } catch (error: any) {
        logError("order by txn: error", { reqId, message: error?.message });
        return res.status(500).json({ code: "ERROR", message: "Failed to load order", body: { order: null } });
    }
}

export default withAuth(handler);

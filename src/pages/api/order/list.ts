import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getOrdersByIds } from "@/repository/order";
import { getTransactionsByIds } from "@/repository/transaction";
import { logError, logInfo } from "@/utils/logger";
import type { OrderRow, TransactionRow } from "@/types/transaction";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type OrderListResponse = JsonResponse<{ orders: Array<OrderRow & { txn?: TransactionRow | null }> }>;

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

async function handler(req: NextApiRequest, res: NextApiResponse<OrderListResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { orders: [] } });
        }

        res.setHeader("Cache-Control", "no-store");

        const ids = parseIds(req.query.ids);
        logInfo("order list: request", { reqId, count: ids.length });

        const orders = await getOrdersByIds(ids);
        const txnIds = orders
            .map((order) => order.txn_id)
            .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

        const txns = await getTransactionsByIds(txnIds);
        const txnMap = new Map<number, TransactionRow>();
        for (const txn of txns) {
            txnMap.set(txn.id, txn);
        }

        const enriched = orders.map((order) => ({ ...order, txn: order.txn_id ? txnMap.get(order.txn_id) ?? null : null }));

        return res.status(200).json({ code: "OK", message: "success", body: { orders: enriched } });
    } catch (error: any) {
        logError("order list: error", { reqId, message: error?.message });
        return res.status(500).json({ code: "ERROR", message: "Failed to load orders", body: { orders: [] } });
    }
}

export default withAuth(handler);

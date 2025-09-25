import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionsByIds, getMethodById } from "@/repository/transaction";
import { getOrdersByTxnIds } from "@/repository/order";
import { logError, logInfo } from "@/utils/logger";
import type { OrderRow, TransactionMethod, TransactionRow } from "@/types/transaction";
import { isExpiredUTC } from "@/utils/time";

export const config = { runtime: "nodejs" };

type TxnDetails = TransactionRow & {
    isExpired: boolean;
    method: Pick<TransactionMethod, "id" | "code" | "name" | "type"> | null;
    order: OrderRow | null;
};

type DetailsResponse = { code: string; message: string; body: { txns: TxnDetails[] } };

type PostPayload = { ids?: unknown };

type AuthContext = { uid?: string; userId?: number | null };

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

async function handler(req: NextApiRequest, res: NextApiResponse<DetailsResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.setHeader("Allow", "GET, POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { txns: [] } });
        }

        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth as AuthContext;
        if (!auth?.uid || typeof auth.userId !== "number" || !Number.isFinite(auth.userId)) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: { txns: [] } });
        }

        const ids = (() => {
            if (req.method === "GET") {
                return parseIds(req.query.ids);
            }
            const payload = (req.body as PostPayload) ?? {};
            return parseIds(payload.ids);
        })();

        logInfo("transaction details: request", { reqId, count: ids.length });

        if (ids.length === 0) {
            return res.status(200).json({ code: "OK", message: "success", body: { txns: [] } });
        }

        const transactions = await getTransactionsByIds(ids);
        const userTransactions = transactions.filter((txn) => txn.user_id === auth.userId);

        if (userTransactions.length === 0) {
            return res.status(200).json({ code: "OK", message: "success", body: { txns: [] } });
        }

        const txnIds = userTransactions.map((txn) => txn.id);
        const methodIds = Array.from(
            new Set(
                userTransactions
                    .map((txn) => txn.txn_method_id)
                    .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
            )
        );

        const [orders, methodEntries] = await Promise.all([
            getOrdersByTxnIds(txnIds),
            Promise.all(methodIds.map((id) => getMethodById(id).then((method) => ({ id, method }))))
        ]);

        const orderMap = new Map<number, OrderRow>();
        for (const order of orders) {
            if (order?.txn_id != null) {
                orderMap.set(order.txn_id, order);
            }
        }

        const methodMap = new Map<number, TransactionMethod>();
        for (const entry of methodEntries) {
            if (entry.method) {
                methodMap.set(entry.id, entry.method);
            }
        }

        const txns: TxnDetails[] = userTransactions.map((txn) => {
            const method = txn.txn_method_id ? methodMap.get(txn.txn_method_id) ?? null : null;
            const order = orderMap.get(txn.id) ?? null;
            return {
                ...txn,
                isExpired: isExpiredUTC(txn.expired_at),
                method: method
                    ? { id: method.id, code: method.code, name: method.name, type: method.type }
                    : null,
                order: order ?? null,
            };
        });

        return res.status(200).json({ code: "OK", message: "success", body: { txns } });
    } catch (error: any) {
        logError("transaction details: error", { reqId, message: error?.message });
        return res.status(500).json({ code: "ERROR", message: "Failed to load transactions", body: { txns: [] } });
    }
}

export default withAuth(handler);

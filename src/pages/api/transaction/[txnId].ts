import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionById, getMethodById } from "@/repository/transaction";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionMethod, TransactionRow } from "@/types/transaction";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type TxnResponse = JsonResponse<{ txn: TransactionRow | null; method: TransactionMethod | null }>;

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

async function handler(req: NextApiRequest, res: NextApiResponse<TxnResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { txn: null, method: null } });
        }

        res.setHeader("Cache-Control", "no-store");

        const txnId = parseTxnId(req.query.txnId);
        if (txnId == null) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid txnId", body: { txn: null, method: null } });
        }

        logInfo("transaction detail: request", { reqId, txnId });

        const txn = await getTransactionById(txnId);
        if (!txn) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Transaction not found", body: { txn: null, method: null } });
        }

        const method = txn.txn_method_id ? await getMethodById(txn.txn_method_id) : null;

        return res.status(200).json({ code: "OK", message: "success", body: { txn, method } });
    } catch (error: any) {
        logError("transaction detail: error", { reqId, message: error?.message });
        return res
            .status(500)
            .json({ code: "ERROR", message: "Failed to load transaction", body: { txn: null, method: null } });
    }
}

export default withAuth(handler);

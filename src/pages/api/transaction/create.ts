import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getMethodById, createTransaction } from "@/repository/transaction";
import { getUserByFirebaseUid, getUserById, adjustBalance } from "@/repository/user";
import type { TransactionRow, TxnStatus, TxnType } from "@/types/transaction";
import { logError, logInfo } from "@/utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type CreateRequest = {
    companyId?: unknown;
    txnType?: unknown;
    methodId?: unknown;
    amount?: unknown;
};

type CreateResponse = JsonResponse<{ txn: TransactionRow | null }>;

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<CreateResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { txn: null } });
        }

        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth as { uid: string; userId: number | null };
        if (!auth?.uid) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: { txn: null } });
        }

        const { companyId: rawCompanyId, txnType: rawTxnType, methodId: rawMethodId, amount: rawAmount } =
            (req.body as CreateRequest) ?? {};

        const companyId = parseNumber(rawCompanyId);
        const methodId = parseNumber(rawMethodId);
        const amount = parseNumber(rawAmount);
        const txnType = typeof rawTxnType === "string" ? (rawTxnType as TxnType) : null;

        if (companyId == null || methodId == null || amount == null || amount <= 0 || !txnType) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid payload", body: { txn: null } });
        }

        if (txnType !== "deposit" && txnType !== "payment") {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Unsupported txnType", body: { txn: null } });
        }

        const user =
            typeof auth.userId === "number" && Number.isFinite(auth.userId)
                ? await getUserById(auth.userId)
                : await getUserByFirebaseUid(auth.uid);

        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found", body: { txn: null } });
        }

        const method = await getMethodById(methodId);
        if (!method) {
            return res.status(400).json({ code: "INVALID_METHOD", message: "Invalid method", body: { txn: null } });
        }

        if (method.type !== "qr" && method.type !== "balance") {
            return res.status(400).json({ code: "INVALID_METHOD", message: "Invalid method", body: { txn: null } });
        }

        if (method.type === "balance" && txnType !== "payment") {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Unsupported balance transaction", body: { txn: null } });
        }

        let balanceAdjusted = false;
        if (method.type === "balance") {
            if (user.balance < amount) {
                return res
                    .status(400)
                    .json({ code: "INSUFFICIENT_BALANCE", message: "Insufficient balance", body: { txn: null } });
            }
            await adjustBalance(user.id, -amount);
            balanceAdjusted = true;
        }

        logInfo("transaction create: creating", { reqId, userId: user.id, companyId, methodId, txnType });

        try {
            const txn = await createTransaction({
                userId: user.id,
                companyId,
                txnType,
                methodId,
                amount,
            });

            return res.status(200).json({ code: "OK", message: "success", body: { txn } });
        } catch (error) {
            if (balanceAdjusted) {
                await adjustBalance(user.id, amount);
            }
            throw error;
        }
    } catch (error: any) {
        logError("transaction create: error", { reqId, message: error?.message });
        const message =
            error?.message === "INVALID_METHOD"
                ? "Invalid method"
                : error?.message === "INSUFFICIENT_BALANCE"
                ? "Insufficient balance"
                : "Failed to create transaction";

        const code =
            error?.message === "INVALID_METHOD"
                ? "INVALID_METHOD"
                : error?.message === "INSUFFICIENT_BALANCE"
                ? "INSUFFICIENT_BALANCE"
                : "TXN_CREATION_FAILED";

        const statusCode = code === "TXN_CREATION_FAILED" ? 500 : 400;

        return res.status(statusCode).json({ code, message, body: { txn: null } });
    }
}

export default withAuth(handler);

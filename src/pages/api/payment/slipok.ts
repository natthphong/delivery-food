import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionById, updateTxnStatus, getMethodById } from "@/repository/transaction";
import { adjustBalance } from "@/repository/user";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionRow } from "@/types/transaction";

export const config = { api: { bodyParser: false }, runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type SlipResponse = JsonResponse<{ txn: TransactionRow | null }>;

type ParsedForm = {
    fields: Record<string, string>;
    files: Record<string, { filename: string; buffer: Buffer }>;
};

function parseMultipart(req: NextApiRequest): Promise<ParsedForm> {
    return new Promise((resolve, reject) => {
        const contentType = req.headers["content-type"];
        if (!contentType || !contentType.startsWith("multipart/form-data")) {
            reject(new Error("INVALID_CONTENT_TYPE"));
            return;
        }

        const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
        if (!boundaryMatch) {
            reject(new Error("INVALID_CONTENT_TYPE"));
            return;
        }
        const boundary = `--${boundaryMatch[1]}`;
        const chunks: Buffer[] = [];

        req.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const raw = buffer.toString("binary");
            const parts = raw.split(boundary).slice(1, -1);
            const fields: Record<string, string> = {};
            const files: ParsedForm["files"] = {};

            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                const [headerSection, ...valueSections] = trimmed.split("\r\n\r\n");
                if (!headerSection || valueSections.length === 0) continue;
                const headers = headerSection.split("\r\n");
                const content = valueSections.join("\r\n\r\n");
                const disposition = headers.find((line) => line.toLowerCase().startsWith("content-disposition"));
                if (!disposition) continue;

                const nameMatch = disposition.match(/name="([^"]+)"/);
                if (!nameMatch) continue;
                const fieldName = nameMatch[1];
                const filenameMatch = disposition.match(/filename="([^"]*)"/);
                const value = content.replace(/\r\n--$/, "");

                if (filenameMatch && filenameMatch[1]) {
                    const bufferValue = Buffer.from(value, "binary");
                    files[fieldName] = { filename: filenameMatch[1], buffer: bufferValue };
                } else {
                    fields[fieldName] = value.trim();
                }
            }

            resolve({ fields, files });
        });
        req.on("error", (err) => {
            reject(err);
        });
    });
}

function parseTxnId(value: string | undefined): number | null {
    if (!value) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function isExpired(txn: TransactionRow): boolean {
    if (!txn.expired_at) return false;
    return Date.now() >= new Date(txn.expired_at).getTime();
}

async function handler(req: NextApiRequest, res: NextApiResponse<SlipResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { txn: null } });
        }

        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth;
        if (!auth?.uid) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: { txn: null } });
        }

        const { fields, files } = await parseMultipart(req);
        const txnId = parseTxnId(fields.txnId);
        if (txnId == null) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid txnId", body: { txn: null } });
        }

        const fileEntry = files.qrFile || files.file || null;
        logInfo("payment slipok: received", { reqId, txnId, hasFile: !!fileEntry });
        if (!fileEntry || !fileEntry.buffer || fileEntry.buffer.length === 0) {
            await updateTxnStatus(txnId, "rejected");
            return res.status(400).json({ code: "INVALID_SLIP", message: "Invalid slip", body: { txn: null } });
        }

        const txn = await getTransactionById(txnId);
        if (!txn) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Transaction not found", body: { txn: null } });
        }

        if (txn.status !== "pending") {
            return res.status(400).json({ code: "TXN_ALREADY_FINAL", message: "Transaction already finalized", body: { txn } });
        }

        if (isExpired(txn)) {
            await updateTxnStatus(txn.id, "rejected");
            return res.status(400).json({ code: "TXN_EXPIRED", message: "Transaction expired", body: { txn: { ...txn, status: "rejected" } });
        }

        const method = txn.txn_method_id ? await getMethodById(txn.txn_method_id) : null;
        if (method && method.type !== "qr") {
            return res.status(400).json({ code: "INVALID_METHOD", message: "Invalid method", body: { txn } });
        }

        await updateTxnStatus(txn.id, "accepted");

        if (txn.txn_type === "deposit" && txn.user_id) {
            await adjustBalance(txn.user_id, txn.amount);
        }

        const updated = await getTransactionById(txn.id);

        return res.status(200).json({ code: "OK", message: "success", body: { txn: updated ?? txn } });
    } catch (error: any) {
        logError("payment slipok: error", { reqId, message: error?.message });
        const code = error?.message === "INVALID_CONTENT_TYPE" ? "BAD_REQUEST" : "ERROR";
        const message = code === "BAD_REQUEST" ? "Invalid request" : "Slip verification failed";
        return res.status(code === "BAD_REQUEST" ? 400 : 500).json({ code, message, body: { txn: null } });
    }
}

export default withAuth(handler);

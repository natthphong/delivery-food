import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionById, updateTxnStatus, getMethodById } from "@/repository/transaction";
import { adjustBalance } from "@/repository/user";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionRow } from "@/types/transaction";
import { toBangkokIso } from "@/utils/time";
import FormData from "form-data";

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

function isExpiredUTC(ts: string | null | undefined): boolean {
    if (!ts) return false;
    return Date.now() >= new Date(ts).getTime();
}

async function callSlipOkVerify({
    file,
    amount,
}: {
    file: { filename: string; buffer: Buffer };
    amount: number;
}): Promise<
    | { ok: true; payload: any }
    | { ok: false; code: string; message: string; payload?: any }
> {
    const url = process.env.NEXT_PUBLIC_SLIP_OK_VERIFY_URL || "";
    const token = process.env.NEXT_PUBLIC_SLIP_OK_TOKEN || "";

    if (!url || !token) {
        return { ok: false, code: "CONFIG_MISSING", message: "SLIPOK config missing" };
    }

    const form = new FormData();
    form.append("amount", amount.toString());
    form.append("files", file.buffer, { filename: file.filename || "slip.jpg" });

    const resp = await fetch(url, {
        method: "POST",
        headers: { "x-authorization": token, ...(typeof (form as any).getHeaders === "function" ? (form as any).getHeaders() : {}) },
        body: form as any,
    });

    const data = await resp.json().catch(() => ({}));

    if (data?.success === true || data?.data?.success === true) {
        return { ok: true, payload: data };
    }
    if (typeof data?.code === "number") {
        if (data.code === 1013) {
            return { ok: false, code: "SLIP_AMOUNT_MISMATCH", message: "Amount does not match slip", payload: data };
        }
        if (data.code === 1000) {
            return { ok: false, code: "INVALID_SLIP", message: "Slip data incomplete", payload: data };
        }
    }
    return { ok: false, code: "INVALID_SLIP", message: data?.message || "Slip verify failed", payload: data };
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
        if (!fileEntry || !fileEntry.buffer?.length) {
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

        if (isExpiredUTC(txn.expired_at)) {
            await updateTxnStatus(txn.id, "rejected");
            const rejected = await getTransactionById(txn.id);
            return res.status(400).json({
                code: "TXN_EXPIRED",
                message: "Transaction expired",
                body: { txn: rejected ?? { ...txn, status: "rejected" } },
            });
        }

        const method = txn.txn_method_id ? await getMethodById(txn.txn_method_id) : null;
        if (method && method.type !== "qr") {
            return res.status(400).json({ code: "INVALID_METHOD", message: "Invalid method", body: { txn } });
        }

        const localBypass = (process.env.NEXT_PUBLIC_ENV_SLIP_OK || "").toUpperCase() === "LOCAL";
        if (!localBypass) {
            const verify = await callSlipOkVerify({ file: fileEntry, amount: txn.amount });
            if (!verify.ok) {
                await updateTxnStatus(txn.id, "rejected");
                const rejected = await getTransactionById(txn.id);
                const code = verify.code || "INVALID_SLIP";
                const message = verify.message || "Slip verification failed";
                return res.status(code === "CONFIG_MISSING" ? 500 : 400).json({
                    code,
                    message,
                    body: { txn: rejected ?? { ...txn, status: "rejected" } },
                });
            }
        }

        await updateTxnStatus(txn.id, "accepted");

        if (txn.txn_type === "deposit" && txn.user_id) {
            await adjustBalance(txn.user_id, txn.amount);
        }

        const updated = await getTransactionById(txn.id);
        const normalized = updated
            ? {
                  ...updated,
                  created_at: toBangkokIso(updated.created_at) ?? updated.created_at,
                  updated_at: toBangkokIso(updated.updated_at) ?? updated.updated_at,
                  expired_at: toBangkokIso(updated.expired_at) ?? updated.expired_at,
              }
            : txn;
        return res.status(200).json({ code: "OK", message: "success", body: { txn: normalized } });
    } catch (error: any) {
        logError("payment slipok: error", { reqId, message: error?.message });
        const code = error?.message === "INVALID_CONTENT_TYPE" ? "BAD_REQUEST" : "ERROR";
        const message = code === "BAD_REQUEST" ? "Invalid request" : "Slip verification failed";
        return res.status(code === "BAD_REQUEST" ? 400 : 500).json({ code, message, body: { txn: null } });
    }
}

export default withAuth(handler);

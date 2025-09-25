import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getTransactionById, updateTxnStatus, getMethodById, stampTxnSlipMeta } from "@/repository/transaction";
import { adjustBalance } from "@/repository/user";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionRow } from "@/types/transaction";
import FormData from "form-data";
import { toBangkokIso } from "@/utils/time";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import {getCompanyById} from "@repository/company";

function uuidv4(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

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
    let value = String(ts).trim();
    if (value.includes(" ") && !value.includes("T")) {
        value = value.replace(" ", "T");
    }
    value = value.replace(/(\.\d{3})\d+$/, "$1");
    if (!/Z$|[+\-]\d{2}:?\d{2}$/.test(value)) {
        value = `${value}Z`;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Date.now() >= parsed : false;
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
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "slipok-"));
    const tmpName =
        (file.filename && path.basename(file.filename)) || `slip-${Date.now()}.jpg`;
    const tmpPath = path.join(tmpDir, tmpName);
    await fs.promises.writeFile(tmpPath, file.buffer);

    const form = new FormData();
    form.append("amount", String(amount));

    form.append("files", fs.createReadStream(tmpPath), { filename: tmpName });


    const headers = {
        "x-authorization": token,
        ...form.getHeaders(), // includes correct content-type with boundary
    };

    try {
        const res = await axios.post(url, form, {
            headers,
            maxBodyLength: Infinity,
            validateStatus: () => true,
        });

        const data = res.data ?? {};
        const success = data?.success === true || data?.data?.success === true;

        if (data?.code === 1013) {
            return {
                ok: false,
                code: "SLIP_AMOUNT_MISMATCH",
                message: "Amount does not match slip",
                payload: data,
            };
        }
        if (data?.code === 1000) {
            return {
                ok: false,
                code: "INVALID_SLIP",
                message: "Slip data incomplete",
                payload: data,
            };
        }

        if (success) {
            return { ok: true, payload: data };
        }

        // Non-success; map by HTTP status
        if (res.status >= 500) {
            return {
                ok: false,
                code: "SLIPOK_UPSTREAM_ERROR",
                message: `SlipOK error (${res.status})`,
                payload: data,
            };
        }

        return {
            ok: false,
            code: typeof data?.code === "string" ? data.code : "INVALID_SLIP",
            message: data?.message || `Slip verify failed (${res.status})`,
            payload: data,
        };
    } catch (err: any) {
        // Network / Axios transport errors
        if (axios.isAxiosError(err)) {
            const status = err.response?.status ?? 0;
            const data = err.response?.data;

            if (data?.code === 1013) {
                return {
                    ok: false,
                    code: "SLIP_AMOUNT_MISMATCH",
                    message: "Amount does not match slip",
                    payload: data,
                };
            }
            if (data?.code === 1000) {
                return {
                    ok: false,
                    code: "INVALID_SLIP",
                    message: "Slip data incomplete",
                    payload: data,
                };
            }
            if (status >= 500) {
                return {
                    ok: false,
                    code: "SLIPOK_UPSTREAM_ERROR",
                    message: `SlipOK error (${status})`,
                    payload: data,
                };
            }

            return {
                ok: false,
                code: "INVALID_SLIP",
                message: data?.message || err.message || "Slip verify failed",
                payload: data,
            };
        }

        return {
            ok: false,
            code: "NETWORK_ERROR",
            message: err?.message || "Network error",
        };
    } finally {
        try {
            await fs.promises.unlink(tmpPath);
        } catch {}
        try {
            await fs.promises.rmdir(tmpDir);
        } catch {}
    }
}
function extractSlipMeta(payload: any): {
    transRef: string | null;
    transDate: string | null;
    transTimestamp: string | null;
    receiverLast4: string | null;
    receiverRaw: string | null;
} {
    const source = payload?.data || payload || {};
    const receiver = source?.receiver || {};
    const proxyVal = receiver?.proxy?.value ?? null;
    const acctVal  = receiver?.account?.value ?? null;

    const fromProxy = last4Digits(proxyVal);
    const fromAcct  = last4Digits(acctVal);

    return {
        transRef: source?.transRef ?? null,
        transDate: source?.transDate ?? null,
        transTimestamp: source?.transTimestamp ?? null,
        receiverLast4: fromProxy || fromAcct || null,
        receiverRaw: proxyVal || acctVal || null,
    };
}


function last4Digits(input?: string | null): string | null {
    if (!input) return null;
    const normalized = String(input).replace(/[xX]/g, "0");

    const digits = normalized.replace(/\D+/g, "");
    if (!digits) return null;

    return digits.slice(-4);
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

        let parsed: ParsedForm;
        try {
            parsed = await parseMultipart(req);
        } catch {
            return res.status(200).json({ code: "BAD_REQUEST", message: "Invalid payload", body: { txn: null } });
        }

        const { fields, files } = parsed;
        const txnId = parseTxnId(fields.txnId);
        if (txnId == null) {
            return res.status(200).json({ code: "BAD_REQUEST", message: "Invalid txnId", body: { txn: null } });
        }

        const fileEntry = files.qrFile || files.file || null;
        logInfo("payment slipok: received", { reqId, txnId, hasFile: !!fileEntry });
        if (!fileEntry || !fileEntry.buffer?.length) {
            await updateTxnStatus(txnId, "rejected");
            return res.status(200).json({ code: "INVALID_SLIP", message: "Invalid slip", body: { txn: null } });
        }

        const txn = await getTransactionById(txnId);
        if (!txn) {
            return res.status(200).json({ code: "NOT_FOUND", message: "Transaction not found", body: { txn: null } });
        }

        if (txn.status !== "pending") {
            return res
                .status(200)
                .json({ code: "TXN_ALREADY_FINAL", message: "Transaction already finalized", body: { txn } });
        }

        if (isExpiredUTC(txn.expired_at)) {
            await updateTxnStatus(txn.id, "rejected");
            const rejected = await getTransactionById(txn.id);
            return res.status(200).json({
                code: "TXN_EXPIRED",
                message: "Transaction expired",
                body: { txn: rejected ?? { ...txn, status: "rejected" } },
            });
        }

        const method = txn.txn_method_id ? await getMethodById(txn.txn_method_id) : null;
        if (method && method.type !== "qr") {
            return res.status(200).json({ code: "INVALID_METHOD", message: "Invalid method", body: { txn } });
        }

        const localBypass = (process.env.NEXT_PUBLIC_ENV_SLIP_OK || "").toUpperCase() === "LOCAL";
        if (!localBypass) {
            const verify = await callSlipOkVerify({ file: fileEntry, amount: txn.amount });
            if (!verify.ok) {
                if (verify.code === "CONFIG_MISSING") {
                    throw new Error("SLIPOK config missing");
                }

                try {
                    const meta = extractSlipMeta(verify.payload);

                    if (meta.transRef || meta.transDate || meta.transTimestamp) {
                        const company = await getCompanyById(txn.company_id);
                        const expectedLast4 = last4Digits(company?.payment_id ?? null);
                        const receiverLast4 = meta.receiverLast4;
                        if (expectedLast4 && expectedLast4 !== receiverLast4) {
                            await updateTxnStatus(txn.id, "rejected");
                            const rejected = await getTransactionById(txn.id);
                            return res.status(200).json({
                                code: "RECEIVER_MISMATCH",
                                message: "Slip receiver does not match destination",
                                body: { txn: rejected ?? { ...txn, status: "rejected" } },
                            });
                        }
                        await stampTxnSlipMeta({
                            txnId: txn.id,
                            transRef: meta.transRef,
                            transDate: meta.transDate,
                            transTimestamp: meta.transTimestamp,
                        });
                    }
                } catch (stampError: any) {
                    logError("payment slipok: stamp error", { reqId, message: stampError?.message });
                    if (stampError?.message === 'duplicate key value violates unique constraint "ux_tbl_transaction_transref_transdate_notnull"'){
                        return res.status(500).json({ code: "TXN_REF_ALREADY", message: "Duplicate Txn Ref", body: { txn: null } });
                    }
                    return res.status(500).json({ code: "INTERNAL_ERROR", message: "error", body: { txn: null } });
                }

                await updateTxnStatus(txn.id, "rejected");
                const rejected = await getTransactionById(txn.id);
                return res.status(200).json({
                    code: verify.code || "INVALID_SLIP",
                    message: verify.message || "Slip verification failed",
                    body: { txn: rejected ?? { ...txn, status: "rejected" } },
                });
            }

        } else {
            const now = new Date();
            const yyyy = now.getUTCFullYear();
            const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(now.getUTCDate()).padStart(2, "0");
            const yyyymmdd = `${yyyy}${mm}${dd}`;
            await stampTxnSlipMeta({
                txnId: txn.id,
                transRef: uuidv4(),
                transDate: yyyymmdd,
                transTimestamp: now.toISOString(),
            });
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
        if (error?.message === "SLIPOK config missing") {
            return res.status(500).json({ code: "CONFIG_MISSING", message: "SlipOK config missing", body: { txn: null } });
        }
        return res.status(200).json({ code: "ERROR", message: "Slip verification failed", body: { txn: null } });
    }
}

export default withAuth(handler);

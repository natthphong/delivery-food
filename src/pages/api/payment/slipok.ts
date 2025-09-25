import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { withAuth } from "@/utils/authMiddleware";
import { logError } from "@/utils/logger";
import { callSlipOkVerify, extractSlipMeta } from "@/utils/slipok";
import { isExpiredUTC, toBangkokIso } from "@/utils/time";
import {
    getTransactionById,
    stampTxnSlipMeta,
    updateTxnStatus,
    type TransactionRecord,
} from "@/repository/transaction";
import { adjustBalance } from "@/repository/user";
import { promoteOrdersToPrepareByTxnId } from "@/repository/order";
import { getCompanyById } from "@/repository/company";
import { last4Digits } from "@/utils/strings";

export const config = { runtime: "nodejs" };

type ApiResponse = { code: string; message: string; body: { txn: TransactionRecord | null } };

type SlipokRequestBody = {
    txnId?: number | string;
    file?: string;
};

function normalizeTxn(txn: TransactionRecord): TransactionRecord {
    return {
        ...txn,
        created_at: toBangkokIso(txn.created_at) ?? txn.created_at,
        updated_at: toBangkokIso(txn.updated_at) ?? txn.updated_at,
        expired_at: txn.expired_at ? toBangkokIso(txn.expired_at) ?? txn.expired_at : null,
        trans_timestamp: txn.trans_timestamp ? toBangkokIso(txn.trans_timestamp) ?? txn.trans_timestamp : null,
    };
}

async function loadNormalizedTxn(id: number, fallback: TransactionRecord): Promise<TransactionRecord> {
    const fresh = await getTransactionById(id);
    if (fresh) {
        return normalizeTxn(fresh);
    }
    return normalizeTxn(fallback);
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
    const reqId = Math.random().toString(36).slice(2, 10);

    try {
        res.setHeader("Cache-Control", "no-store");

        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({
                    code: "METHOD_NOT_ALLOWED",
                    message: "Method Not Allowed",
                    body: { txn: null },
                });
        }

        const auth = (req as any).auth;
        if (!auth?.userId) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: { txn: null } });
        }

        const { txnId, file }: SlipokRequestBody = req.body || {};
        const txnIdNum = typeof txnId === "number" ? txnId : Number(txnId);
        if (!Number.isFinite(txnIdNum) || txnIdNum <= 0) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid transaction id", body: { txn: null } });
        }

        const txn = await getTransactionById(txnIdNum);
        if (!txn) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Transaction not found", body: { txn: null } });
        }

        if (txn.user_id && txn.user_id !== auth.userId) {
            return res.status(403).json({ code: "FORBIDDEN", message: "Forbidden", body: { txn: null } });
        }

        if (isExpiredUTC(txn.expired_at)) {
            return res.status(200).json({
                code: "TXN_EXPIRED",
                message: "Transaction expired",
                body: { txn: normalizeTxn(txn) },
            });
        }

        const envMode = (process.env.NEXT_PUBLIC_ENV_SLIP_OK || "").toUpperCase();
        const localBypass = envMode === "LOCAL";
        const fileEntry = typeof file === "string" && file.trim().length > 0 ? file : null;

        if (!localBypass && !fileEntry) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing slip file", body: { txn: null } });
        }

        let latestTxn = txn;

        if (!localBypass) {
            const verify = await callSlipOkVerify({ file: fileEntry as string, amount: txn.amount });
            const meta = verify.payload ? extractSlipMeta(verify.payload) : null;

            if (meta?.receiverLast4) {
                try {
                    const company = txn.company_id ? await getCompanyById(txn.company_id) : null;
                    const expectedLast4 = last4Digits(company?.payment_id ?? null);
                    if (expectedLast4 && expectedLast4 !== meta.receiverLast4) {
                        if (meta.transRef || meta.transDate || meta.transTimestamp) {
                            try {
                                await stampTxnSlipMeta({
                                    txnId: txn.id,
                                    transRef: meta.transRef,
                                    transDate: meta.transDate,
                                    transTimestamp: meta.transTimestamp,
                                });
                            } catch (err) {
                                logError("payment slipok: receiver stamp error", { reqId, message: (err as any)?.message });
                            }
                        }
                        const pendingTxn = await loadNormalizedTxn(txn.id, latestTxn);
                        return res.status(200).json({
                            code: "RECEIVER_MISMATCH",
                            message: "Slip receiver does not match destination",
                            body: { txn: pendingTxn },
                        });
                    }
                } catch (err: any) {
                    logError("payment slipok: receiver check error", { reqId, message: err?.message });
                }
            }

            if (!verify.ok) {
                if (verify.code === "CONFIG_MISSING") {
                    return res
                        .status(500)
                        .json({ code: "CONFIG_MISSING", message: "Slip verification unavailable", body: { txn: null } });
                }
                if (verify.code === "INTERNAL_ERROR") {
                    return res
                        .status(500)
                        .json({ code: "INTERNAL_ERROR", message: "Slip verification failed", body: { txn: null } });
                }

                if (meta && (meta.transRef || meta.transDate || meta.transTimestamp)) {
                    try {
                        await stampTxnSlipMeta({
                            txnId: txn.id,
                            transRef: meta.transRef,
                            transDate: meta.transDate,
                            transTimestamp: meta.transTimestamp,
                        });
                    } catch (err: any) {
                        const message = String(err?.message || "");
                        if (message.includes("ux_tbl_transaction_transref_transdate_notnull")) {
                            const pendingTxn = await loadNormalizedTxn(txn.id, latestTxn);
                            return res.status(200).json({
                                code: "TXN_REF_ALREADY",
                                message: "Duplicate Txn Ref",
                                body: { txn: pendingTxn },
                            });
                        }
                        logError("payment slipok: stamp error", { reqId, message: err?.message });
                        return res.status(500).json({ code: "INTERNAL_ERROR", message: "error", body: { txn: null } });
                    }
                }

                const pendingTxn = await loadNormalizedTxn(txn.id, latestTxn);
                return res.status(200).json({
                    code: verify.code || "INVALID_SLIP",
                    message: verify.message || "Slip verification failed",
                    body: { txn: pendingTxn },
                });
            }

            if (meta) {
                try {
                    await stampTxnSlipMeta({
                        txnId: txn.id,
                        transRef: meta.transRef,
                        transDate: meta.transDate,
                        transTimestamp: meta.transTimestamp,
                    });
                } catch (err: any) {
                    logError("payment slipok: stamp success error", { reqId, message: err?.message });
                }
            }
        } else {
            const now = new Date();
            const yyyy = now.getUTCFullYear();
            const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(now.getUTCDate()).padStart(2, "0");
            const syntheticDate = `${yyyy}${mm}${dd}`;
            try {
                await stampTxnSlipMeta({
                    txnId: txn.id,
                    transRef: randomUUID(),
                    transDate: syntheticDate,
                    transTimestamp: now.toISOString(),
                });
            } catch (err: any) {
                logError("payment slipok: local stamp error", { reqId, message: err?.message });
            }
        }

        await updateTxnStatus(txn.id, "accepted");
        if (txn.txn_type === "deposit" && txn.user_id) {
            try {
                await adjustBalance(txn.user_id, txn.amount);
            } catch (err: any) {
                logError("payment slipok: adjust balance error", { reqId, message: err?.message });
            }
        }
        try {
            await promoteOrdersToPrepareByTxnId(txn.id);
        } catch (err: any) {
            logError("payment slipok: promote orders error", { reqId, message: err?.message });
        }

        latestTxn = (await getTransactionById(txn.id)) ?? latestTxn;

        return res.status(200).json({
            code: "OK",
            message: "success",
            body: { txn: normalizeTxn(latestTxn) },
        });
    } catch (error: any) {
        logError("payment slipok: unexpected error", { reqId, message: error?.message });
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "error", body: { txn: null } });
    }
}

export default withAuth(handler);

import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getMethodById, createTransaction, updateTxnStatus } from "@/repository/transaction";
import { createOrder } from "@/repository/order";
import { getUserByFirebaseUid, getUserById, adjustBalance, getSystemConfig } from "@/repository/user";
import { getCompanyById } from "@/repository/company";
import { getBranchById } from "@/repository/branch";
import type { OrderDetails, OrderRow, TransactionMethod, TransactionRow } from "@/types/transaction";
import { logError, logInfo } from "@/utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type PaymentRequest = {
    companyId?: unknown;
    methodId?: unknown;
    amount?: unknown;
    branchId?: unknown;
    orderDetails?: unknown;
};

type PaymentResponse = JsonResponse<{
    method: TransactionMethod | null;
    txn: TransactionRow | null;
    order: OrderRow | null;
    paymentPayload?: { payment_id: string } | null;
    balance?: number;
}>;

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

function sanitizeOrderDetails(raw: any, userId: number, branchId: number): OrderDetails {
    if (!raw || typeof raw !== "object") {
        throw new Error("BAD_ORDER_DETAILS");
    }

    const branchIdStr = (() => {
        const value = (raw as any).branchId;
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
        return String(branchId);
    })();

    const listRaw = Array.isArray((raw as any).productList) ? (raw as any).productList : [];
    const productList = listRaw.map((item: any, index: number) => {
        if (!item || typeof item !== "object") {
            throw new Error(`BAD_PRODUCT_${index}`);
        }
        const qty = Number(item.qty);
        const price = Number(item.price);
        const productId = typeof item.productId === "string" ? item.productId : String(item.productId ?? "");
        const productName = typeof item.productName === "string" ? item.productName : "";
        const productAddOns = Array.isArray(item.productAddOns)
            ? item.productAddOns.map((addon: any) => ({
                  name: typeof addon?.name === "string" ? addon.name : "",
                  price: Number(addon?.price) || 0,
              }))
            : [];
        return {
            qty: Number.isFinite(qty) ? qty : 0,
            price: Number.isFinite(price) ? price : 0,
            productId,
            productName,
            productAddOns,
        };
    });

    return {
        userId,
        branchId: branchIdStr,
        branchName: typeof (raw as any).branchName === "string" ? (raw as any).branchName : "",
        productList,
    };
}

function ensureQtyLimits(details: OrderDetails, maxQty: number) {
    for (const item of details.productList) {
        if (item.qty > maxQty) {
            throw new Error("MAX_QTY_EXCEEDED");
        }
        if (item.qty <= 0) {
            throw new Error("INVALID_QTY");
        }
    }
}

async function handler(req: NextApiRequest, res: NextApiResponse<PaymentResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { method: null, txn: null, order: null } });
        }

        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth as { uid: string; userId: number | null };
        if (!auth?.uid) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Missing token", body: { method: null, txn: null, order: null } });
        }

        const payload = (req.body as PaymentRequest) ?? {};
        const companyId = parseNumber(payload.companyId);
        const methodId = parseNumber(payload.methodId);
        const amount = parseNumber(payload.amount);
        const branchId = parseNumber(payload.branchId);

        if (companyId == null || methodId == null || amount == null || amount <= 0 || branchId == null) {
            return res
                .status(400)
                .json({ code: "BAD_REQUEST", message: "Invalid payload", body: { method: null, txn: null, order: null } });
        }

        const user =
            typeof auth.userId === "number" && Number.isFinite(auth.userId)
                ? await getUserById(auth.userId)
                : await getUserByFirebaseUid(auth.uid);

        if (!user) {
            return res
                .status(404)
                .json({ code: "NOT_FOUND", message: "User not found", body: { method: null, txn: null, order: null } });
        }

        const method = await getMethodById(methodId);
        if (!method || (method.type !== "qr" && method.type !== "balance")) {
            return res
                .status(400)
                .json({ code: "INVALID_METHOD", message: "Invalid method", body: { method: null, txn: null, order: null } });
        }

        const branch = await getBranchById(branchId);
        if (!branch) {
            return res
                .status(404)
                .json({ code: "NOT_FOUND", message: "Branch not found", body: { method: null, txn: null, order: null } });
        }

        if (branch.company_id !== companyId) {
            return res
                .status(400)
                .json({ code: "BAD_REQUEST", message: "Branch mismatch", body: { method: null, txn: null, order: null } });
        }

        const company = await getCompanyById(companyId);
        if (!company) {
            return res
                .status(404)
                .json({ code: "NOT_FOUND", message: "Company not found", body: { method: null, txn: null, order: null } });
        }

        if (!company.payment_id) {
            return res
                .status(400)
                .json({ code: "CONFIG_MISSING", message: "Missing payment config", body: { method: null, txn: null, order: null } });
        }

        const configMap = await getSystemConfig();
        const maxQtyPerItem = Number(configMap.MAX_QTY_PER_ITEM ?? "10") || 10;
        const maxBranchOrder = Number(configMap.MAXIMUM_BRANCH_ORDER ?? "0") || 0;

        const orderDetails = sanitizeOrderDetails(payload.orderDetails, user.id, branchId);

        if (maxBranchOrder === 1 && orderDetails.branchId !== String(branchId)) {
            return res
                .status(400)
                .json({ code: "MULTI_BRANCH_NOT_ALLOWED", message: "Branch restriction", body: { method: null, txn: null, order: null } });
        }

        ensureQtyLimits(orderDetails, maxQtyPerItem);

        if (method.type === "balance" && user.balance < amount) {
            return res
                .status(400)
                .json({ code: "INSUFFICIENT_BALANCE", message: "Insufficient balance", body: { method, txn: null, order: null } });
        }

        logInfo("payment: start", { reqId, userId: user.id, method: method.type, amount });

        let txn: TransactionRow | null = null;
        let order: OrderRow | null = null;
        let balanceAdjusted = false;

        try {
            if (method.type === "balance") {
                await adjustBalance(user.id, -amount);
                balanceAdjusted = true;
            }

            txn = await createTransaction({
                userId: user.id,
                companyId,
                txnType: "payment",
                methodId,
                amount,
                expiresInSec: 900,
            });

            order = await createOrder({
                userId: user.id,
                branchId,
                txnId: txn.id,
                details: orderDetails,
                status: "PENDING",
            });
        } catch (error) {
            if (txn?.id) {
                await updateTxnStatus(txn.id, "rejected");
            }
            if (balanceAdjusted) {
                await adjustBalance(user.id, amount);
            }
            logError("payment: creation error", { reqId, message: (error as any)?.message });
            return res
                .status(500)
                .json({ code: "ORDER_CREATION_FAILED", message: "Failed to create order", body: { method, txn: null, order: null } });
        }

        const responseBody: PaymentResponse["body"] = {
            method,
            txn,
            order,
            paymentPayload: method.type === "qr" ? { payment_id: company.payment_id } : null,
        };

        if (method.type === "balance") {
            const refreshed = await getUserById(user.id);
            responseBody.balance = refreshed?.balance ?? 0;
        }

        return res.status(200).json({ code: "OK", message: "success", body: responseBody });
    } catch (error: any) {
        logError("payment: error", { reqId, message: error?.message });
        const code = (() => {
            if (error?.message === "BAD_ORDER_DETAILS") return "BAD_REQUEST";
            if (error?.message === "MAX_QTY_EXCEEDED") return "BAD_REQUEST";
            if (error?.message === "INVALID_QTY") return "BAD_REQUEST";
            return error?.message === "INSUFFICIENT_BALANCE" ? "INSUFFICIENT_BALANCE" : "ERROR";
        })();
        const statusCode = code === "BAD_REQUEST" ? 400 : code === "INSUFFICIENT_BALANCE" ? 400 : 500;
        const message =
            code === "BAD_REQUEST"
                ? "Invalid order details"
                : code === "INSUFFICIENT_BALANCE"
                ? "Insufficient balance"
                : "Payment failed";
        return res.status(statusCode).json({ code, message, body: { method: null, txn: null, order: null } });
    }
}

export default withAuth(handler);

import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getMethodById, createTransaction, updateTxnStatus } from "@/repository/transaction";
import { createOrder } from "@/repository/order";
import { getUserByFirebaseUid, getUserById, adjustBalance, getSystemConfig } from "@/repository/user";
import { getCompanyById } from "@/repository/company";
import { getBranchById } from "@/repository/branch";
import type { OrderDetails, OrderRow, TransactionMethod, TransactionRow } from "@/types/transaction";
import { logError, logInfo } from "@/utils/logger";
import { isBranchOpen } from "@/utils/branchOpen";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type PaymentRequest = {
    companyId?: unknown;
    methodId?: unknown;
    amount?: unknown;
    branchId?: unknown;
    orderDetails?: unknown;
    delivery?: unknown;
};

type PaymentResponse = JsonResponse<{
    method: TransactionMethod | null;
    txn: TransactionRow | null;
    order: OrderRow | null;
    paymentPayload?: { payment_id: string } | null;
    balance?: number;
}>;

function respondBusiness(
    res: NextApiResponse<PaymentResponse>,
    code: string,
    message: string,
    body: PaymentResponse["body"] = { method: null, txn: null, order: null }
) {
    return res.status(200).json({ code, message, body });
}

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

function sanitizeDeliveryCandidate(candidate: unknown) {
    if (!candidate || typeof candidate !== "object") {
        return null;
    }
    const lat = Number((candidate as any).lat);
    const lng = Number((candidate as any).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    const distance = Number((candidate as any).distanceKm);
    return {
        lat,
        lng,
        distanceKm: Number.isFinite(distance) ? distance : null,
    };
}

function extractDelivery(orderRaw: any, fallback: unknown) {
    const first = sanitizeDeliveryCandidate(orderRaw?.delivery);
    if (first) return first;
    return sanitizeDeliveryCandidate(fallback);
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

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res
            .status(405)
            .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { method: null, txn: null, order: null } });
    }

    res.setHeader("Cache-Control", "no-store");

    try {
        const auth = (req as any).auth as { uid: string; userId: number | null } | undefined;
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
            return respondBusiness(res, "BAD_REQUEST", "Invalid payload");
        }

        const user =
            typeof auth.userId === "number" && Number.isFinite(auth.userId)
                ? await getUserById(auth.userId)
                : await getUserByFirebaseUid(auth.uid);

        if (!user) {
            return respondBusiness(res, "USER_NOT_FOUND", "User not found");
        }

        const method = await getMethodById(methodId);
        if (!method || (method.type !== "qr" && method.type !== "balance")) {
            return respondBusiness(res, "INVALID_METHOD", "Invalid method");
        }

        const branch = await getBranchById(branchId);
        if (!branch) {
            return respondBusiness(res, "BRANCH_NOT_FOUND", "Branch not found");
        }

        if (branch.company_id !== companyId) {
            return respondBusiness(res, "BRANCH_MISMATCH", "Branch mismatch");
        }

        const branchIsOpen = isBranchOpen({
            isForceClosed: !!branch.is_force_closed,
            openHours: branch.open_hours,
        });
        if (!branchIsOpen) {
            return respondBusiness(res, "BRANCH_CLOSED", "Branch is closed");
        }

        const company = await getCompanyById(companyId);
        if (!company) {
            return respondBusiness(res, "COMPANY_NOT_FOUND", "Company not found");
        }
        if (!company.payment_id) {
            return res
                .status(500)
                .json({ code: "CONFIG_MISSING", message: "Missing payment config", body: { method: null, txn: null, order: null } });
        }

        const configMap = await getSystemConfig();
        const maxQtyPerItem = Number(configMap.MAX_QTY_PER_ITEM ?? "10") || 10;
        const maxBranchOrder = Number(configMap.MAXIMUM_BRANCH_ORDER ?? "0") || 0;

        const orderDetailsBase = sanitizeOrderDetails(payload.orderDetails, user.id, branchId);

        if (maxBranchOrder === 1 && orderDetailsBase.branchId !== String(branchId)) {
            return respondBusiness(res, "MULTI_BRANCH_NOT_ALLOWED", "Branch restriction");
        }

        ensureQtyLimits(orderDetailsBase, maxQtyPerItem);

        if (method.type === "balance" && user.balance < amount) {
            return respondBusiness(res, "INSUFFICIENT_BALANCE", "Insufficient balance", {
                method,
                txn: null,
                order: null,
                balance: user.balance,
                paymentPayload: null,
            });
        }

        const delivery = extractDelivery(payload.orderDetails, payload.delivery);
        const mergedOrderDetails: OrderDetails = {
            ...orderDetailsBase,
            delivery,
            branchLat: branch.lat ?? null,
            branchLng: branch.lng ?? null,
        };

        logInfo("payment:start", {
            reqId,
            userId: user.id,
            method: method.type,
            amount,
            branchId,
        });

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
                details: mergedOrderDetails,
                status: "PENDING",
            });
        } catch (error: any) {
            if (txn?.id) {
                await updateTxnStatus(txn.id, "rejected");
            }
            if (balanceAdjusted) {
                await adjustBalance(user.id, amount);
            }
            logError("payment:creation_error", { reqId, message: error?.message });
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
        logError("payment:error", { reqId, message: error?.message });
        const code = (() => {
            if (error?.message === "BAD_ORDER_DETAILS") return "BAD_REQUEST";
            if (error?.message?.startsWith("BAD_PRODUCT_")) return "BAD_REQUEST";
            if (error?.message === "MAX_QTY_EXCEEDED") return "BAD_REQUEST";
            if (error?.message === "INVALID_QTY") return "BAD_REQUEST";
            return "ERROR";
        })();
        if (code === "BAD_REQUEST") {
            return respondBusiness(res, code, "Invalid order details");
        }
        return res
            .status(500)
            .json({ code: "ERROR", message: "Payment failed", body: { method: null, txn: null, order: null } });
    }
}

export default withAuth(handler);

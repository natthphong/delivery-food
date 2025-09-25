import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getOrdersByIds } from "@/repository/order";
import { getTransactionsByIds } from "@/repository/transaction";
import { getBranchById } from "@/repository/branch";
import { logError, logInfo } from "@/utils/logger";
import type { OrderDetails, OrderStatus, TransactionRow, TxnStatus } from "@/types/transaction";
import type { DisplayStatus } from "@/constants/status";
import { isExpiredUTC, toBangkokIso } from "@/utils/time";

export const config = { runtime: "nodejs" };

type JsonResponse<T> = { code: string; message: string; body: T };
type ApiResponseBody = { orders: OrderDetailEntry[] };

type OrderDetailEntry = {
    id: number;
    status: OrderStatus;
    displayStatus: DisplayStatus;
    created_at: string;
    updated_at: string;
    order_details: OrderDetails;
    branch: BranchSummary | null;
    txn: TxnSummary | null;
};

type BranchSummary = {
    id: number;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
};

type TxnSummary = {
    id: number;
    status: TxnStatus;
    expired_at: string | null;
    isExpired: boolean;
};

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

function deriveDisplayStatus(orderStatus: OrderStatus, txn: TxnSummary | null): DisplayStatus {
    if (txn?.status === "rejected") {
        return "REJECTED";
    }
    if (txn?.status === "pending" && txn.isExpired) {
        return "EXPIRED";
    }
    return (orderStatus as DisplayStatus) ?? "PENDING";
}

async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse<ApiResponseBody>>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET" && req.method !== "POST") {
            res.setHeader("Allow", "GET, POST");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { orders: [] } });
        }

        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth as AuthContext;
        if (!auth?.uid || typeof auth.userId !== "number" || !Number.isFinite(auth.userId)) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: { orders: [] } });
        }

        const ids = (() => {
            if (req.method === "GET") {
                return parseIds(req.query.ids);
            }
            const payload = (req.body as PostPayload) ?? {};
            return parseIds(payload.ids);
        })().slice(0, 100);

        logInfo("order details: request", { reqId, count: ids.length });

        if (ids.length === 0) {
            return res.status(200).json({ code: "OK", message: "success", body: { orders: [] } });
        }

        const orders = await getOrdersByIds(ids);
        const userOrders = orders.filter((order) => order.order_details?.userId === auth.userId);

        if (userOrders.length === 0) {
            return res.status(200).json({ code: "OK", message: "success", body: { orders: [] } });
        }

        const txnIds = Array.from(
            new Set(
                userOrders
                    .map((order) => order.txn_id)
                    .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
            )
        );

        const branchIds = Array.from(new Set(userOrders.map((order) => order.branch_id).filter((id) => Number.isFinite(id))));

        const [transactions, branchEntries] = await Promise.all([
            txnIds.length > 0 ? getTransactionsByIds(txnIds) : Promise.resolve([] as TransactionRow[]),
            Promise.all(
                branchIds.map((id) =>
                    getBranchById(id)
                        .then((branch) => ({ id, branch }))
                        .catch(() => ({ id, branch: null }))
                )
            ),
        ]);

        const txnMap = new Map<number, TransactionRow>();
        for (const txn of transactions) {
            txnMap.set(txn.id, txn);
        }

        const branchMap = new Map<number, BranchSummary>();
        for (const entry of branchEntries) {
            if (entry.branch) {
                branchMap.set(entry.id, {
                    id: entry.branch.id,
                    name: entry.branch.name,
                    address: entry.branch.address_line ?? null,
                    lat: entry.branch.lat ?? null,
                    lng: entry.branch.lng ?? null,
                });
            }
        }

        const responseOrders: OrderDetailEntry[] = userOrders.map((order) => {
            const txnRow = order.txn_id ? txnMap.get(order.txn_id) ?? null : null;
            const txn: TxnSummary | null = txnRow
                ? {
                      id: txnRow.id,
                      status: txnRow.status,
                      expired_at: toBangkokIso(txnRow.expired_at) ?? txnRow.expired_at ?? null,
                      isExpired: isExpiredUTC(txnRow.expired_at),
                  }
                : null;
            const displayStatus = deriveDisplayStatus(order.status, txn);
            const branch = branchMap.get(order.branch_id) ?? null;

            return {
                id: order.id,
                status: order.status,
                displayStatus,
                created_at: toBangkokIso(order.created_at) ?? order.created_at,
                updated_at: toBangkokIso(order.updated_at) ?? order.updated_at,
                order_details: order.order_details,
                branch,
                txn,
            };
        });

        return res.status(200).json({ code: "OK", message: "success", body: { orders: responseOrders } });
    } catch (error: any) {
        logError("order details: error", { reqId, message: error?.message });
        return res.status(500).json({ code: "ERROR", message: "Failed to load orders", body: { orders: [] } });
    }
}

export default withAuth(handler);

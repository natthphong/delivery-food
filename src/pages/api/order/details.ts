import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { logError } from "@/utils/logger";
import { toBangkokIso } from "@/utils/time";
import { getOrdersByIds, getOrdersByUser, getOrderByTxnId } from "@/repository/order";
import { getTransactionsByIds } from "@/repository/transaction";
import { getBranchesByIds } from "@/repository/branch";

type ApiRes = { code: string; message: string; body: any };

function isExpiredUTC(ts: string | null | undefined): boolean {
    if (!ts) return false;
    let s = String(ts).trim();
    if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");
    s = s.replace(/(\.\d{3})\d+$/, "$1");
    if (!/Z$|[+\-]\d{2}:?\d{2}$/.test(s)) s = `${s}Z`;
    return Date.now() >= Date.parse(s);
}

async function handler(req: NextApiRequest, res: NextApiResponse<ApiRes>) {
    try {
        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth;
        if (!auth?.uid || !auth?.userId) {
            return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token", body: {} });
        }
        const userId = Number(auth.userId);

        const { ids, txnId } = req.method === "GET" ? req.query : (req.body || {});
        let orders: any[] = [];

        if (txnId) {
            const ord = await getOrderByTxnId(Number(txnId), userId);
            orders = ord ? [ord] : [];
        } else if (ids) {
            const idList = (typeof ids === "string" ? ids.split(",") : ids)
                .map((x: any) => Number(x))
                .filter((n: number) => Number.isFinite(n));
            orders = await getOrdersByIds(idList, userId);
        } else {
            orders = await getOrdersByUser(userId, { limit: 50 });
        }

        const branchIds = Array.from(new Set(orders.map((o) => o.branch_id)));
        const txnIds = Array.from(new Set(orders.map((o) => o.txn_id).filter(Boolean)));

        const [branches, txns] = await Promise.all([
            getBranchesByIds(branchIds),
            txnIds.length ? getTransactionsByIds(txnIds as number[]) : Promise.resolve([]),
        ]);

        const branchMap = new Map(branches.map((b: any) => [b.id, b]));
        const txnMap = new Map(txns.map((t: any) => [t.id, t]));

        const dto = orders.map((o: any) => {
            const branch = branchMap.get(o.branch_id) || null;
            const txn = o.txn_id ? txnMap.get(o.txn_id) || null : null;

            const isExpired = txn?.expired_at ? isExpiredUTC(txn.expired_at) : false;
            const displayStatus =
                o.status === "PENDING"
                    ? txn?.status === "rejected"
                        ? "REJECTED"
                        : txn?.status === "pending" && isExpired
                          ? "EXPIRED"
                          : "PENDING"
                    : o.status;

            return {
                id: o.id,
                status: o.status,
                displayStatus,
                created_at: toBangkokIso(o.created_at) ?? o.created_at,
                updated_at: toBangkokIso(o.updated_at) ?? o.updated_at,
                order_details: o.order_details,
                branch: branch
                    ? {
                          id: branch.id,
                          name: branch.name,
                          address: branch.address_line || null,
                          lat: branch.lat ?? null,
                          lng: branch.lng ?? null,
                      }
                    : null,
                txn: txn
                    ? {
                          id: txn.id,
                          status: txn.status,
                          expired_at: txn.expired_at ? toBangkokIso(txn.expired_at) ?? txn.expired_at : null,
                          isExpired,
                      }
                    : null,
            };
        });

        return res.status(200).json({ code: "OK", message: "success", body: { orders: dto } });
    } catch (e: any) {
        logError("order details error", { message: e?.message });
        return res.status(200).json({ code: "ERROR", message: "Failed to load orders", body: { orders: [] } });
    }
}

export default withAuth(handler);

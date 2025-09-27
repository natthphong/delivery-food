import { getSupabase } from "@utils/supabaseServer";
import type { OrderDetails, OrderRow, OrderStatus, TransactionRow } from "@/types/transaction";
import { appendIdWithTrim } from "@/utils/history";
import { getTransactionsByIds } from "@/repository/transaction";
import { toBangkokIso } from "@/utils/time";

const ORDER_HISTORY_LIMIT = 100;

function normalizeOrderDetails(raw: any, fallbackBranchId: number): OrderDetails {
    if (!raw || typeof raw !== "object") {
        return {
            userId: 0,
            branchId: String(fallbackBranchId ?? ""),
            branchName: "",
            productList: [],
            delivery: null,
        };
    }

    const branchId = (() => {
        const value = (raw as any).branchId;
        if (typeof value === "string" && value.trim()) {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value);
        }
        return String(fallbackBranchId ?? "");
    })();

    const productListRaw = Array.isArray((raw as any).productList) ? (raw as any).productList : [];
    const productList = productListRaw.map((item: any) => ({
        qty: Number(item?.qty) || 0,
        price: Number(item?.price) || 0,
        productId: String(item?.productId ?? ""),
        productName: String(item?.productName ?? ""),
        productAddOns: Array.isArray(item?.productAddOns)
            ? item.productAddOns.map((addon: any) => ({
                  name: String(addon?.name ?? ""),
                  price: Number(addon?.price) || 0,
              }))
            : [],
    }));

    return {
        userId: Number((raw as any).userId) || 0,
        branchId,
        branchName: typeof (raw as any).branchName === "string" ? (raw as any).branchName : "",
        productList,
        delivery: (() => {
            const deliveryRaw = (raw as any).delivery;
            if (!deliveryRaw || typeof deliveryRaw !== "object") {
                return null;
            }
            const lat = Number((deliveryRaw as any).lat);
            const lng = Number((deliveryRaw as any).lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return null;
            }
            const distance = Number((deliveryRaw as any).distanceKm);
            return {
                lat,
                lng,
                distanceKm: Number.isFinite(distance) ? distance : null,
            };
        })(),
        branchLat: (() => {
            const rawLat = (raw as any).branchLat;
            if (rawLat == null) {
                return null;
            }
            const lat = Number(rawLat);
            return Number.isFinite(lat) ? lat : null;
        })(),
        branchLng: (() => {
            const rawLng = (raw as any).branchLng;
            if (rawLng == null) {
                return null;
            }
            const lng = Number(rawLng);
            return Number.isFinite(lng) ? lng : null;
        })(),
    };
}

function mapOrder(row: any): OrderRow {
    if (!row) {
        throw new Error("Order row is empty");
    }

    const details = normalizeOrderDetails(row.order_details, row.branch_id);
    const createdAt = toBangkokIso(row.created_at ?? new Date()) ?? toBangkokIso(new Date())!;
    const updatedAt = toBangkokIso(row.updated_at ?? new Date()) ?? createdAt;

    return {
        id: Number(row.id),
        branch_id: Number(row.branch_id),
        txn_id: row.txn_id == null ? null : Number(row.txn_id),
        order_details: details,
        status: (row.status as OrderStatus) ?? "PENDING",
        created_at: createdAt,
        updated_at: updatedAt,
    };
}

async function updateOrderHistory(userId: number, orderId: number): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select("order_history")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load order history");
    }

    const history = appendIdWithTrim(data?.order_history as number[] | null | undefined, orderId, ORDER_HISTORY_LIMIT);
    const { error: updateError } = await supabase
        .from("tbl_user")
        .update({ order_history: history })
        .eq("id", userId);

    if (updateError) {
        throw new Error(updateError.message || "Failed to update order history");
    }
}

export async function createOrder(input: {
    userId: number;
    branchId: number;
    txnId: number | null;
    details: OrderDetails;
    status?: OrderStatus;
}): Promise<OrderRow> {
    const supabase = getSupabase();

    const insertPayload: Record<string, any> = {
        branch_id: input.branchId,
        txn_id: input.txnId,
        order_details: input.details,
        status: input.status ?? "PENDING",
    };

    const { data, error } = await supabase.from("tbl_order").insert(insertPayload).select("*").single();

    if (error || !data) {
        throw new Error(error?.message || "Failed to create order");
    }

    await updateOrderHistory(input.userId, data.id);

    return mapOrder(data);
}

export async function getUserOrders(
    userId: number,
    opts?: { limit?: number; offset?: number }
): Promise<OrderRow[]> {
    const supabase = getSupabase();
    const query = supabase
        .from("tbl_order")
        .select("*")
        .contains("order_details", { userId })
        .order("created_at", { ascending: false });

    if (opts?.limit != null) {
        query.limit(opts.limit);
    }
    if (opts?.offset != null) {
        query.range(opts.offset, (opts.offset ?? 0) + (opts.limit ?? 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message || "Failed to load orders");
    }

    return (data ?? []).map(mapOrder);
}

export async function getUserOrderWithTxn(userId: number): Promise<Array<OrderRow & { txn?: TransactionRow | null }>> {
    const orders = await getUserOrders(userId);
    const txnIds = orders
        .map((order) => order.txn_id)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

    const transactions = await getTransactionsByIds(txnIds);
    const txnMap = new Map<number, TransactionRow>();
    for (const txn of transactions) {
        txnMap.set(txn.id, txn);
    }

    return orders.map((order) => ({ ...order, txn: order.txn_id ? txnMap.get(order.txn_id) ?? null : null }));
}

export async function getOrdersByIds(orderIds: number[]): Promise<OrderRow[]> {
    if (orderIds.length === 0) {
        return [];
    }
    const supabase = getSupabase();
    const uniqueIds = Array.from(new Set(orderIds.filter((id) => Number.isFinite(id)))).map((id) => Number(id));
    if (uniqueIds.length === 0) {
        return [];
    }
    const { data, error } = await supabase
        .from("tbl_order")
        .select("*")
        .in("id", uniqueIds)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message || "Failed to load orders");
    }

    return (data ?? []).map(mapOrder);
}

export async function getOrdersByTxnIds(txnIds: number[]): Promise<OrderRow[]> {
    if (txnIds.length === 0) {
        return [];
    }

    const supabase = getSupabase();
    const uniqueTxnIds = Array.from(new Set(txnIds.filter((id) => Number.isFinite(id)))).map((id) => Number(id));
    if (uniqueTxnIds.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from("tbl_order")
        .select("*")
        .in("txn_id", uniqueTxnIds)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message || "Failed to load orders by transaction ids");
    }

    return (data ?? []).map(mapOrder);
}

export async function getOrderByTxnId(txnId: number): Promise<OrderRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_order")
        .select("*")
        .eq("txn_id", txnId)
        .order("created_at", { ascending: false })
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load order");
    }

    return data ? mapOrder(data) : null;
}

export { mapOrder as mapOrderRow };

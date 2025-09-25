import { getSupabase } from "@/utils/supabaseServer";

export type OrderSummary = {
    id: number;
    status: string;
};

export async function listOrdersByTxnId(txnId: number): Promise<OrderSummary[]> {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_order")
        .select("id,status")
        .eq("txn_id", txnId);

    if (error) {
        throw new Error(error.message || "Failed to load orders by txn");
    }

    return (data ?? []).map((row: any) => ({
        id: Number(row.id),
        status: row.status ?? "PENDING",
    }));
}

export async function promoteOrdersToPrepareByTxnId(txnId: number): Promise<void> {
    const sb = getSupabase();
    const { error } = await sb
        .from("tbl_order")
        .update({ status: "PREPARE", updated_at: new Date().toISOString() })
        .eq("txn_id", txnId)
        .eq("status", "PENDING");

    if (error) {
        throw new Error(error.message || "Failed to promote orders to PREPARE");
    }
}

export async function getOrderByTxnId(txnId: number, userId: number) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_order")
        .select("*")
        .eq("txn_id", txnId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(error.message || "Failed to load order by txn");
    if (data && (data as any).order_details?.userId !== userId) return null;
    return data || null;
}

export async function getOrdersByIds(ids: number[], userId: number) {
    if (!ids.length) return [];
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_order")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
    if (error) throw new Error(error.message || "Failed to load orders by ids");
    return (data || []).filter((o: any) => o?.order_details?.userId === userId);
}

export async function getOrdersByUser(userId: number, { limit = 50 } = {}) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_order")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message || "Failed to load orders by user");
    return (data || []).filter((o: any) => o?.order_details?.userId === userId);
}

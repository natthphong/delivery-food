import { getSupabase } from "@/utils/supabaseServer";

export type TransactionRecord = {
    id: number;
    company_id: number | null;
    user_id: number | null;
    amount: number;
    status: string;
    txn_type: string | null;
    expired_at: string | null;
    created_at: string;
    updated_at: string;
    trans_ref: string | null;
    trans_date: string | null;
    trans_timestamp: string | null;
};

function toNumber(value: any): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function mapTransaction(row: any): TransactionRecord {
    if (!row) {
        throw new Error("Transaction row is empty");
    }

    return {
        id: Number(row.id),
        company_id: row.company_id == null ? null : Number(row.company_id),
        user_id: row.user_id == null ? null : Number(row.user_id),
        amount: toNumber(row.amount),
        status: row.status ?? "pending",
        txn_type: row.txn_type ?? null,
        expired_at: row.expired_at ? String(row.expired_at) : null,
        created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
        updated_at: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
        trans_ref: row.trans_ref ?? null,
        trans_date: row.trans_date ?? null,
        trans_timestamp: row.trans_timestamp ? String(row.trans_timestamp) : null,
    };
}

export async function getTransactionById(id: number): Promise<TransactionRecord | null> {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_transaction")
        .select(
            "id,company_id,user_id,amount,status,txn_type,expired_at,created_at,updated_at,trans_ref,trans_date,trans_timestamp"
        )
        .eq("id", id)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load transaction");
    }

    return data ? mapTransaction(data) : null;
}

export async function updateTxnStatus(id: number, status: string): Promise<void> {
    const sb = getSupabase();
    const { error } = await sb
        .from("tbl_transaction")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

    if (error) {
        throw new Error(error.message || "Failed to update transaction status");
    }
}

export async function stampTxnSlipMeta(params: {
    txnId: number;
    transRef: string | null | undefined;
    transDate: string | null | undefined;
    transTimestamp: string | null | undefined;
}): Promise<void> {
    const { txnId, transRef, transDate, transTimestamp } = params;
    const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };

    if (transRef !== undefined) {
        payload.trans_ref = transRef ?? null;
    }
    if (transDate !== undefined) {
        payload.trans_date = transDate ?? null;
    }
    if (transTimestamp !== undefined) {
        payload.trans_timestamp = transTimestamp ?? null;
    }

    const sb = getSupabase();
    const { error } = await sb.from("tbl_transaction").update(payload).eq("id", txnId);

    if (error) {
        throw new Error(error.message || "Failed to stamp slip metadata");
    }
}

export async function getTransactionsByIds(ids: number[]) {
    if (!ids.length) return [];
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_transaction")
        .select("id,status,expired_at")
        .in("id", ids);
    if (error) {
        throw new Error(error.message || "Failed to load transactions by ids");
    }
    return data || [];
}

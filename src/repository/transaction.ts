import { getSupabase } from "@utils/supabaseServer";
import type {
    TransactionMethod,
    TransactionRow,
    TxnMethodType,
    TxnStatus,
    TxnType,
} from "@/types/transaction";
import { appendIdWithTrim } from "@/utils/history";
import { toBangkokIso } from "@/utils/time";

const SUPPORTED_METHOD_TYPES: TxnMethodType[] = ["qr", "balance"];
const TXN_HISTORY_LIMIT = 50;

function parseNumber(value: any): number {
    if (value == null) {
        return 0;
    }
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
}

function mapMethod(row: any): TransactionMethod {
    if (!row) {
        throw new Error("Method row is empty");
    }
    return {
        id: Number(row.id),
        code: String(row.code),
        name: String(row.name),
        type: (row.type as TxnMethodType) ?? "qr",
        details: row.details ?? null,
    };
}

export function mapTransactionRow(row: any): TransactionRow {
    if (!row) {
        throw new Error("Transaction row is empty");
    }
    const createdAt = toBangkokIso(row.created_at ?? new Date()) ?? toBangkokIso(new Date())!;
    const updatedAt = toBangkokIso(row.updated_at ?? new Date()) ?? createdAt;
    const expiredAt = toBangkokIso(row.expired_at ?? null);
    const transTimestamp = toBangkokIso(row.trans_timestamp ?? null);

    return {
        id: Number(row.id),
        company_id: Number(row.company_id),
        user_id: row.user_id == null ? null : Number(row.user_id),
        txn_type: (row.txn_type as TxnType) ?? "payment",
        txn_method_id: row.txn_method_id == null ? null : Number(row.txn_method_id),
        reversal: Boolean(row.reversal),
        amount: parseNumber(row.amount),
        adjust_amount: parseNumber(row.adjust_amount),
        status: (row.status as TxnStatus) ?? "pending",
        trans_ref: row.trans_ref == null ? null : String(row.trans_ref),
        trans_date: row.trans_date == null ? null : String(row.trans_date),
        trans_timestamp: transTimestamp,
        expired_at: expiredAt,
        created_at: createdAt,
        updated_at: updatedAt,
    };
}

async function fetchMethodById(methodId: number): Promise<TransactionMethod | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_transaction_method")
        .select("id, code, name, type, details, is_deleted")
        .eq("id", methodId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load transaction method");
    }
    if (!data || data.is_deleted === "Y") {
        return null;
    }
    return mapMethod(data);
}

export async function listActiveMethods(companyId: number): Promise<TransactionMethod[]> {
    // companyId reserved for future use (multi-tenant filtering)
    void companyId;
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_transaction_method")
        .select("id, code, name, type, details, is_deleted")
        .in("type", SUPPORTED_METHOD_TYPES)
        .eq("is_deleted", "N")
        .order("id", { ascending: true });

    if (error) {
        throw new Error(error.message || "Failed to list transaction methods");
    }

    return (data ?? []).map(mapMethod);
}

async function updateTxnHistory(userId: number, txnId: number): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select("txn_history")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load txn history");
    }

    const history = appendIdWithTrim(data?.txn_history as number[] | null | undefined, txnId, TXN_HISTORY_LIMIT);
    const { error: updateError } = await supabase
        .from("tbl_user")
        .update({ txn_history: history })
        .eq("id", userId);

    if (updateError) {
        throw new Error(updateError.message || "Failed to update txn history");
    }
}

export async function createTransaction(input: {
    userId: number;
    companyId: number;
    txnType: TxnType;
    methodId: number;
    amount: number;
    expiresInSec?: number;
}): Promise<TransactionRow> {
    const supabase = getSupabase();
    const method = await fetchMethodById(input.methodId);
    if (!method || !SUPPORTED_METHOD_TYPES.includes(method.type)) {
        throw new Error("INVALID_METHOD");
    }

    const status: TxnStatus = method.type === "balance" ? "accepted" : "pending";
    const expiresAt =
        method.type === "qr"
            ? new Date(Date.now() + (input.expiresInSec ?? 900) * 1000).toISOString()
            : null;

    const insertPayload: Record<string, any> = {
        company_id: input.companyId,
        user_id: input.userId,
        txn_type: input.txnType,
        txn_method_id: input.methodId,
        amount: input.amount,
        status,
        expired_at: expiresAt,
    };

    const { data, error } = await supabase
        .from("tbl_transaction")
        .insert(insertPayload)
        .select("*")
        .single();

    if (error || !data) {
        throw new Error(error?.message || "Failed to create transaction");
    }

    await updateTxnHistory(input.userId, data.id);

    return mapTransactionRow(data);
}

export async function updateTxnStatus(txnId: number, status: TxnStatus): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
        .from("tbl_transaction")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", txnId);

    if (error) {
        throw new Error(error.message || "Failed to update transaction status");
    }
}

export async function stampTxnSlipMeta(input: {
    txnId: number;
    transRef: string | null;
    transDate: string | Date | null;
    transTimestamp: string | Date | null;
}): Promise<void> {
    const supabase = getSupabase();

    let trans_date: string | null = null;
    if (typeof input.transDate === "string" && /^\d{8}$/.test(input.transDate)) {
        trans_date = `${input.transDate.slice(0, 4)}-${input.transDate.slice(4, 6)}-${input.transDate.slice(6, 8)}`;
    } else if (input.transDate instanceof Date) {
        trans_date = input.transDate.toISOString().slice(0, 10);
    } else if (typeof input.transDate === "string" && input.transDate.trim()) {
        trans_date = input.transDate;
    }

    let trans_timestamp: string | null = null;
    if (input.transTimestamp instanceof Date) {
        trans_timestamp = input.transTimestamp.toISOString();
    } else if (typeof input.transTimestamp === "string" && input.transTimestamp.trim()) {
        const parsed = new Date(input.transTimestamp);
        if (!Number.isNaN(parsed.getTime())) {
            trans_timestamp = parsed.toISOString();
        }
    }

    const { error } = await supabase
        .from("tbl_transaction")
        .update({
            trans_ref: input.transRef,
            trans_date,
            trans_timestamp,
            updated_at: new Date().toISOString(),
        })
        .eq("id", input.txnId);

    if (error) {
        throw new Error(error.message || "Failed to stamp transaction slip meta");
    }
}

export async function getTransactionById(txnId: number): Promise<TransactionRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("tbl_transaction").select("*").eq("id", txnId).maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load transaction");
    }

    return data ? mapTransactionRow(data) : null;
}

export async function getTransactionsByIds(txnIds: number[]): Promise<TransactionRow[]> {
    if (txnIds.length === 0) {
        return [];
    }
    const supabase = getSupabase();
    const uniqueIds = Array.from(new Set(txnIds.filter((id) => Number.isFinite(id)))).map((id) => Number(id));
    if (uniqueIds.length === 0) {
        return [];
    }
    const { data, error } = await supabase
        .from("tbl_transaction")
        .select("*")
        .in("id", uniqueIds)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message || "Failed to load transactions");
    }

    return (data ?? []).map(mapTransactionRow);
}

export async function getMethodById(methodId: number): Promise<TransactionMethod | null> {
    return fetchMethodById(methodId);
}

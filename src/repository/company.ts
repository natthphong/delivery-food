import { getSupabase } from "@utils/supabaseServer";

export type CompanyRow = {
    id: number;
    name: string | null;
    payment_id: string | null;
    txn_method_id: number | null;
};

export async function getCompanyById(companyId: number): Promise<CompanyRow | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_company")
        .select("id, name, payment_id, txn_method_id")
        .eq("id", companyId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to load company");
    }

    if (!data) {
        return null;
    }

    return {
        id: Number(data.id),
        name: data.name ?? null,
        payment_id: data.payment_id ?? null,
        txn_method_id: data.txn_method_id == null ? null : Number(data.txn_method_id),
    };
}

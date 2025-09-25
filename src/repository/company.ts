import { getSupabase } from "@/utils/supabaseServer";

export type CompanySummary = {
    id: number;
    name: string | null;
    payment_id: string | null;
};

export async function getCompanyById(id: number): Promise<CompanySummary | null> {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("tbl_company")
        .select("id,name,payment_id")
        .eq("id", id)
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
    };
}

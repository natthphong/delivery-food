import { getSupabase } from "@utils/supabaseServer";

export async function getConfigValue(name: string): Promise<string | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_system_config")
        .select("config_value")
        .eq("config_name", name)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch config value");
    }

    return data?.config_value ?? null;
}

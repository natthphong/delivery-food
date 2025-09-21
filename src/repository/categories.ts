// src/repository/categories.ts
import { getSupabase } from "@utils/supabaseServer";

export type CategoryRow = {
    id: number;
    name: string;
    is_enabled?: boolean | null;
    is_active?: boolean | null;
};

export type CategoryRecord = { id: number; name: string };

function normalizeCategory(row: CategoryRow): CategoryRecord | null {
    if (row == null || !row.name) {
        return null;
    }

    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isFinite(id)) {
        return null;
    }

    if (typeof row.is_enabled === "boolean" && !row.is_enabled) {
        return null;
    }

    if (typeof row.is_active === "boolean" && !row.is_active) {
        return null;
    }

    return { id, name: row.name };
}

export async function listAllCategories(): Promise<CategoryRecord[]> {
    const supabase = getSupabase();

    const columns = "id, name, is_enabled, is_active";
    const { data, error } = await supabase.from("tbl_category").select(columns);

    let rows: CategoryRow[] | null = data as CategoryRow[] | null;

    if (error) {
        const fallback = await supabase.from("tbl_category").select("id, name");
        if (fallback.error) {
            throw new Error(fallback.error.message || "Failed to load categories");
        }
        rows = fallback.data as CategoryRow[] | null;
    }

    return (rows ?? []).map(normalizeCategory).filter((value): value is CategoryRecord => value !== null);
}


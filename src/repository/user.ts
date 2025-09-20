// src/repository/user.ts
import { getSupabase } from "@utils/supabaseServer";

export type UserRecord = {
    id: number;
    firebase_uid: string;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean;
    is_phone_verified: boolean;
    created_at: string;
    updated_at: string;
};

function mapUser(row: any): UserRecord {
    return {
        id: row.id,
        firebase_uid: row.firebase_uid,
        email: row.email ?? null,
        phone: row.phone ?? null,
        provider: row.provider ?? null,
        is_email_verified: !!row.is_email_verified,
        is_phone_verified: !!row.is_phone_verified,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function upsertUser(params: {
    firebaseUid: string;                    // must be the conflict key
    email?: string | null;
    phone?: string | null;
    provider: string;
    isEmailVerified: boolean | null;
    isPhoneVerified: boolean | null;
}): Promise<UserRecord> {
    const {
        firebaseUid,
        email,
        phone,
        provider,
        isEmailVerified,
        isPhoneVerified,
    } = params;

    const supabase = getSupabase();

    const updateFields = {
        last_login: new Date(),
    }

    const { data: updatedRow, error: updErr } = await supabase
        .from("tbl_user")
        .update(updateFields)
        .eq("firebase_uid", firebaseUid)
        .select(
            "id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, created_at, updated_at"
        )
        .maybeSingle();

    if (updErr) {
        throw new Error(updErr.message || "Failed to update user");
    }
    if (updatedRow) {
        return mapUser(updatedRow);
    }

    const insertPayload = {
        firebase_uid: firebaseUid,
        email: email ?? null,
        phone: phone ?? null,
        provider,
        is_email_verified: isEmailVerified ?? null,
        is_phone_verified: isPhoneVerified ?? null,
    };

    const { data: insertedRow, error: insErr } = await supabase
        .from("tbl_user")
        .insert(insertPayload)
        .select(
            "id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, created_at, updated_at"
        )
        .single();

    if (insErr || !insertedRow) {
        throw new Error(insErr?.message || "Failed to insert user");
    }

    return mapUser(insertedRow);
}

export async function getUserById(userId: number): Promise<UserRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select(
            "id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, created_at, updated_at"
        )
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user");
    }

    return data ? mapUser(data) : null;
}

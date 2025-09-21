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
    card: any[] | null;
    created_at: string;
    updated_at: string;
};

const USER_SELECT =
    "id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, card, created_at, updated_at";

function mapUser(row: any): UserRecord {
    return {
        id: row.id,
        firebase_uid: row.firebase_uid,
        email: row.email ?? null,
        phone: row.phone ?? null,
        provider: row.provider ?? null,
        is_email_verified: !!row.is_email_verified,
        is_phone_verified: !!row.is_phone_verified,
        card: Array.isArray(row.card) ? row.card : row.card ?? null,
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
        .select(USER_SELECT)
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
        .select(USER_SELECT)
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
        .select(USER_SELECT)
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user");
    }

    return data ? mapUser(data) : null;
}

export async function getUserByFirebaseUid(uid: string): Promise<UserRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select(USER_SELECT)
        .eq("firebase_uid", uid)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user by uid");
    }

    return data ? mapUser(data) : null;
}

type UserContactPatch = {
    email?: string | null;
    phone?: string | null;
    is_email_verified?: boolean | null;
    is_phone_verified?: boolean | null;
};

function hasOwnProperty<T extends object, K extends PropertyKey>(obj: T, key: K): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export async function updateUserContact(uid: string, patch: UserContactPatch): Promise<UserRecord> {
    const supabase = getSupabase();

    const updatePayload: Record<string, any> = {};

    if (hasOwnProperty(patch, "email")) {
        updatePayload.email = patch.email ?? null;
    }
    if (hasOwnProperty(patch, "phone")) {
        updatePayload.phone = patch.phone ?? null;
    }
    if (hasOwnProperty(patch, "is_email_verified")) {
        updatePayload.is_email_verified = patch.is_email_verified ?? null;
    }
    if (hasOwnProperty(patch, "is_phone_verified")) {
        updatePayload.is_phone_verified = patch.is_phone_verified ?? null;
    }

    let shouldInsert = Object.keys(updatePayload).length === 0;

    if (!shouldInsert) {
        const { data, error } = await supabase
            .from("tbl_user")
            .update(updatePayload)
            .eq("firebase_uid", uid)
            .select(USER_SELECT)
            .maybeSingle();

        if (error) {
            throw new Error(error.message || "Failed to update user contact");
        }

        if (data) {
            return mapUser(data);
        }
        shouldInsert = true;
    }

    const insertPayload: Record<string, any> = { firebase_uid: uid };
    if (hasOwnProperty(patch, "email")) {
        insertPayload.email = patch.email ?? null;
    }
    if (hasOwnProperty(patch, "phone")) {
        insertPayload.phone = patch.phone ?? null;
    }
    if (hasOwnProperty(patch, "is_email_verified")) {
        insertPayload.is_email_verified = patch.is_email_verified ?? null;
    }
    if (hasOwnProperty(patch, "is_phone_verified")) {
        insertPayload.is_phone_verified = patch.is_phone_verified ?? null;
    }

    const { data: inserted, error: insertError } = await supabase
        .from("tbl_user")
        .insert(insertPayload)
        .select(USER_SELECT)
        .single();

    if (insertError || !inserted) {
        throw new Error(insertError?.message || "Failed to upsert user contact");
    }

    return mapUser(inserted);
}

export async function getUserCard(uid: string): Promise<any[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select("card")
        .eq("firebase_uid", uid)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user card");
    }

    const card = data?.card;
    if (Array.isArray(card)) {
        return card;
    }
    return [];
}

export async function saveUserCard(uid: string, card: any[]): Promise<any[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("tbl_user")
        .update({ card })
        .eq("firebase_uid", uid)
        .select("card")
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to save user card");
    }

    if (data?.card) {
        return Array.isArray(data.card) ? data.card : [];
    }

    const { data: inserted, error: insertError } = await supabase
        .from("tbl_user")
        .insert({ firebase_uid: uid, card })
        .select("card")
        .single();

    if (insertError) {
        throw new Error(insertError.message || "Failed to insert user card");
    }

    return Array.isArray(inserted?.card) ? inserted.card : [];
}

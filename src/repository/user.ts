// src/repository/user.ts
import { CartBranchGroup, UserRecord } from "@/types";
import { getSupabase } from "@utils/supabaseServer";

export const USER_SELECT =
    "id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, balance, card, created_at, updated_at";

function normalizeCard(input: unknown): CartBranchGroup[] {
    if (!Array.isArray(input)) {
        return [];
    }
    return input as CartBranchGroup[];
}

function mapUser(row: any): UserRecord {
    if (!row) {
        throw new Error("User row is empty");
    }
    const isEmailVerified =
        typeof row.is_email_verified === "boolean" ? row.is_email_verified : row.is_email_verified == null ? null : !!row.is_email_verified;
    const isPhoneVerified =
        typeof row.is_phone_verified === "boolean" ? row.is_phone_verified : row.is_phone_verified == null ? null : !!row.is_phone_verified;

    return {
        id: Number(row.id),
        firebase_uid: String(row.firebase_uid),
        email: row.email ?? null,
        phone: row.phone ?? null,
        provider: row.provider ?? null,
        is_email_verified: isEmailVerified,
        is_phone_verified: isPhoneVerified,
        balance: (() => {
            const raw = row.balance;
            if (raw == null) return 0;
            const parsed = typeof raw === "number" ? raw : Number(raw);
            return Number.isFinite(parsed) ? parsed : 0;
        })(),
        card: normalizeCard(row.card),
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
    };
}

export async function isEmailTaken(email: string, excludeUserId?: number): Promise<boolean> {
    const supabase = getSupabase();
    let query = supabase.from("tbl_user").select("id").eq("email", email).limit(1);
    if (typeof excludeUserId === "number" && Number.isFinite(excludeUserId)) {
        query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query;
    if (error) {
        throw new Error(error.message || "Failed to check email");
    }
    return (data ?? []).length > 0;
}

export async function isPhoneTaken(phone: string, excludeUserId?: number): Promise<boolean> {
    const supabase = getSupabase();
    let query = supabase.from("tbl_user").select("id").eq("phone", phone).limit(1);
    if (typeof excludeUserId === "number" && Number.isFinite(excludeUserId)) {
        query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query;
    if (error) {
        throw new Error(error.message || "Failed to check phone");
    }
    return (data ?? []).length > 0;
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

export async function getUserById(userId: number, columns: string = USER_SELECT): Promise<UserRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select(columns)
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user");
    }

    return data ? mapUser(data) : null;
}

export async function getUserByFirebaseUid(uid: string, columns: string = USER_SELECT): Promise<UserRecord | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select(columns)
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

export async function getUserCard(uid: string): Promise<CartBranchGroup[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tbl_user")
        .select("card")
        .eq("firebase_uid", uid)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to fetch user card");
    }

    return normalizeCard(data?.card);
}

export async function saveUserCard(uid: string, card: CartBranchGroup[]): Promise<UserRecord> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("tbl_user")
        .update({ card })
        .eq("firebase_uid", uid)
        .select(USER_SELECT)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || "Failed to save user card");
    }

    if (data?.card) {
        return mapUser(data);
    }

    const { data: inserted, error: insertError } = await supabase
        .from("tbl_user")
        .insert({ firebase_uid: uid, card })
        .select(USER_SELECT)
        .single();

    if (insertError) {
        throw new Error(insertError.message || "Failed to insert user card");
    }

    if (!inserted) {
        throw new Error("Failed to persist user card");
    }

    return mapUser(inserted);
}

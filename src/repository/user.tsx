// src/repository/user.tsx
import { db } from "@/utils/db";

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

export async function upsertUser(params: {
    firebaseUid: string;
    email?: string | null;
    phone?: string | null;
    provider: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
}): Promise<UserRecord> {
    const { firebaseUid, email, phone, provider, isEmailVerified, isPhoneVerified } = params;

    const sql = `
    INSERT INTO tbl_user (firebase_uid, email, phone, provider, is_email_verified, is_phone_verified)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      provider = EXCLUDED.provider,
      is_email_verified = EXCLUDED.is_email_verified,
      is_phone_verified = EXCLUDED.is_phone_verified,
      updated_at = NOW()
    RETURNING id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, created_at, updated_at
  `;
    const vals = [firebaseUid, email || null, phone || null, provider, isEmailVerified, isPhoneVerified];
    const { rows } = await db.query(sql, vals);
    return rows[0];
}

export async function getUserById(userId: number): Promise<UserRecord | null> {
    const sql = `
        SELECT id, firebase_uid, email, phone, provider, is_email_verified, is_phone_verified, created_at, updated_at
        FROM tbl_user
        WHERE id = $1
    `;
    const { rows } = await db.query(sql, [userId]);
    return rows[0] || null;
}

// src/repository/user.ts
import { sql } from "@/utils/db";

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

    const result = await sql<UserRecord>`
        INSERT INTO delivery_app.tbl_user (
            firebase_uid,
            email,
            phone,
            provider,
            is_email_verified,
            is_phone_verified
        )
        VALUES (
            ${firebaseUid},
            ${email ?? null},
            ${phone ?? null},
            ${provider},
            ${isEmailVerified},
            ${isPhoneVerified}
        )
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            provider = EXCLUDED.provider,
            is_email_verified = EXCLUDED.is_email_verified,
            is_phone_verified = EXCLUDED.is_phone_verified,
            updated_at = NOW()
        RETURNING
            id,
            firebase_uid,
            email,
            phone,
            provider,
            is_email_verified,
            is_phone_verified,
            created_at,
            updated_at;
    `;

    return result.rows[0];
}

export async function getUserById(userId: number): Promise<UserRecord | null> {
    const result = await sql<UserRecord>`
        SELECT
            id,
            firebase_uid,
            email,
            phone,
            provider,
            is_email_verified,
            is_phone_verified,
            created_at,
            updated_at
        FROM delivery_app.tbl_user
        WHERE id = ${userId};
    `;

    return result.rows[0] ?? null;
}

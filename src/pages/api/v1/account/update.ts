import type { NextApiRequest, NextApiResponse } from "next";
import { resolveAuth } from "@utils/authMiddleware";
import { getUserByFirebaseUid, updateUserContact, isEmailTaken, isPhoneTaken } from "@repository/user";
import { logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type AccountUpdateRequest = {
    email?: string | null;
    phone?: string | null;
    is_email_verified?: boolean | null;
    is_phone_verified?: boolean | null;
};

type AccountUpdateResponseBody = {
    user: {
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
};

function hasOwn<T extends object, K extends PropertyKey>(obj: T, key: K): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeEmail(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new Error("Invalid email");
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function normalizePhone(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new Error("Invalid phone");
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function normalizeFlag(value: unknown, field: string): boolean | null {
    if (value === null) {
        return null;
    }
    if (typeof value === "boolean") {
        return value;
    }
    throw new Error(`Invalid value for ${field}`);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<JsonResponse<AccountUpdateResponseBody | null>>
) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res
            .status(405)
            .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
    }

    try {
        const auth = await resolveAuth(req);
        if (!auth?.uid) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Missing or invalid token", body: null });
        }

        if (!req.body || typeof req.body !== "object") {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid payload", body: null });
        }

        const body = req.body as AccountUpdateRequest;
        const existing = await getUserByFirebaseUid(auth.uid);

        const patch: AccountUpdateRequest = {};

        let emailChanged = false;
        if (hasOwn(body, "email")) {
            const normalizedEmail = normalizeEmail(body.email ?? null);
            patch.email = normalizedEmail;
            emailChanged = normalizedEmail !== (existing?.email ?? null);
        }

        let requestedEmailVerified: boolean | null | undefined;
        if (hasOwn(body, "is_email_verified")) {
            requestedEmailVerified = normalizeFlag(body.is_email_verified, "is_email_verified");
        }

        if (emailChanged) {
            patch.is_email_verified = false;
        } else if (requestedEmailVerified !== undefined) {
            patch.is_email_verified = requestedEmailVerified;
        }

        let phoneChanged = false;
        if (hasOwn(body, "phone")) {
            const normalizedPhone = normalizePhone(body.phone ?? null);
            patch.phone = normalizedPhone;
            phoneChanged = normalizedPhone !== (existing?.phone ?? null);
        }

        let requestedPhoneVerified: boolean | null | undefined;
        if (hasOwn(body, "is_phone_verified")) {
            requestedPhoneVerified = normalizeFlag(body.is_phone_verified, "is_phone_verified");
        }

        if (phoneChanged && requestedPhoneVerified === undefined) {
            patch.is_phone_verified = false;
        }
        if (requestedPhoneVerified !== undefined) {
            patch.is_phone_verified = requestedPhoneVerified;
        }

        if (emailChanged && patch.email) {
            const duplicate = await isEmailTaken(patch.email, existing?.id);
            if (duplicate) {
                return res
                    .status(409)
                    .json({ code: "DUPLICATE_EMAIL", message: "Email already in use", body: null });
            }
        }

        if (phoneChanged && patch.phone) {
            const duplicate = await isPhoneTaken(patch.phone, existing?.id);
            if (duplicate) {
                return res
                    .status(409)
                    .json({ code: "DUPLICATE_PHONE", message: "Phone number already in use", body: null });
            }
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "No updates provided", body: null });
        }

        const updated = await updateUserContact(auth.uid, patch);

        return res.status(200).json({
            code: "OK",
            message: "success",
            body: {
                user: {
                    id: updated.id,
                    firebase_uid: updated.firebase_uid,
                    email: updated.email,
                    phone: updated.phone,
                    provider: updated.provider,
                    is_email_verified: updated.is_email_verified,
                    is_phone_verified: updated.is_phone_verified,
                    card: updated.card,
                    created_at: updated.created_at,
                    updated_at: updated.updated_at,
                },
            },
        });
    } catch (error: any) {
        logError("account update error", { message: error?.message });
        if (error instanceof Error && error.message.startsWith("Invalid")) {
            return res.status(400).json({ code: "BAD_REQUEST", message: error.message, body: null });
        }
        return res
            .status(500)
            .json({ code: "INTERNAL_ERROR", message: "Failed to update account", body: null });
    }
}

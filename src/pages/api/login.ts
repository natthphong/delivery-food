import type { NextApiRequest, NextApiResponse } from "next";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";
import { getUserByFirebaseUid, upsertUser } from "@repository/user";
import { signAccessToken, mintRefreshToken } from "@utils/jwt";
import { logInfo, logError } from "@utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            res.setHeader("x-req-id", reqId);
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        logInfo("login API: request", {
            reqId,
            ua: req.headers["user-agent"],
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            bodyKeys: Object.keys(req.body || {}),
        });

        const { idToken } = req.body || {};
        if (!idToken) {
            logError("login API: missing idToken", { reqId });
            res.setHeader("x-req-id", reqId);
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });
        }

        const decoded = await verifyFirebaseIdToken(idToken);
        const firebaseUid: string = (decoded.user_id as string) || (decoded.uid as string);
        if (!firebaseUid) {
            logError("login API: decoded token missing uid", {
                reqId,
                decodedKeys: Object.keys(decoded || {}),
            });
            res.setHeader("x-req-id", reqId);
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid token", body: null });
        }

        const email = (decoded.email as string) || null;
        const phone = (decoded.phone_number as string) || null;
        const provider = (decoded.firebase && (decoded.firebase as any).sign_in_provider) || "unknown";
        const isEmailVerified = !!decoded.email_verified || provider === "google.com";
        const isPhoneVerified = !!phone;

        logInfo("login API: upsert user", {
            reqId,
            firebaseUid,
            emailPresent: !!email,
            phonePresent: !!phone,
            provider,
            isEmailVerified,
            isPhoneVerified,
        });

        const user = await upsertUser({
            firebaseUid,
            email,
            phone,
            provider,
            isEmailVerified,
            isPhoneVerified,
        });

        const freshUser = await getUserByFirebaseUid(firebaseUid);

        const accessToken = signAccessToken({ uid: firebaseUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: firebaseUid, userId: user.id });

        logInfo("login API: success", { reqId, userId: user.id });
        res.setHeader("x-req-id", reqId);
        return res.status(200).json({
            code: "OK",
            message: "Login success",
            body: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    firebase_uid: freshUser?.firebase_uid ?? user.firebase_uid,
                    email: freshUser?.email ?? user.email,
                    phone: freshUser?.phone ?? user.phone,
                    provider: freshUser?.provider ?? user.provider,
                    is_email_verified: freshUser?.is_email_verified ?? user.is_email_verified ?? null,
                    is_phone_verified: freshUser?.is_phone_verified ?? user.is_phone_verified ?? null,
                    card: freshUser?.card ?? [],
                    created_at: freshUser?.created_at ?? user.created_at,
                    updated_at: freshUser?.updated_at ?? user.updated_at,
                },
            },
        });
    } catch (e: any) {
        logError("login API: exception", {
            reqId,
            name: e?.name,
            code: e?.code,
            message: e?.message,
            stack: process.env.NODE_ENV !== "production" ? e?.stack : undefined,
            firebaseError: e?.errorInfo || undefined,
            responseData: e?.response?.data || undefined,
            status: e?.status,
        });

        res.setHeader("x-req-id", reqId);
        return res
            .status(400)
            .json({ code: "LOGIN_FAILED", message: "Login failed", body: null });
    }
}

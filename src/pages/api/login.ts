// src/pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";
import { upsertUser } from "@repository/user";
import { signAccessToken, mintRefreshToken } from "@utils/jwt";
import { logInfo, logError } from "@utils/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const reqId = Math.random().toString(36).slice(2, 8); // simple correlation id
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ error: "Method Not Allowed" });
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
            return res.status(400).json({ error: "Missing idToken" });
        }

        const decoded = await verifyFirebaseIdToken(idToken);
        const firebaseUid: string = (decoded.user_id as string) || (decoded.uid as string);
        if (!firebaseUid) {
            logError("login API: decoded token missing uid", { reqId, decodedKeys: Object.keys(decoded || {}) });
            return res.status(400).json({ error: "Invalid token: no uid" });
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

        const accessToken = signAccessToken({ uid: firebaseUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: firebaseUid, userId: user.id });

        logInfo("login API: success", { reqId, userId: user.id });
        res.setHeader("x-req-id", reqId);
        return res.status(200).json({
            message: "Login success",
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                provider: user.provider,
                is_email_verified: user.is_email_verified,
                is_phone_verified: user.is_phone_verified,
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
        // surface the code if known (helps client to branch on Firebase codes)
        return res.status(400).json({
            error: e?.message || "Login failed",
            code: e?.code || "unknown_error",
            reqId,
        });
    }
}

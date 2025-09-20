// src/pages/api/login.ts
export const config = { runtime: 'nodejs' }
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";
import { upsertUser } from "@repository/user";
import { signAccessToken, mintRefreshToken } from "@utils/jwt";
import { logInfo, logError } from "@utils/logger";

function isUpstreamUnavailable(error: any) {
    const status =
        typeof error?.status === "number"
            ? error.status
            : typeof error?.response?.status === "number"
            ? error.response.status
            : undefined;
    if (status && status >= 500) return true;
    const code = typeof error?.code === "string" ? error.code.toUpperCase() : undefined;
    if (!code) return false;
    return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "EAI_AGAIN", "ENOTFOUND", "EPIPE"].includes(code);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const reqId = Math.random().toString(36).slice(2, 8);
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
    }

    try {
        logInfo("login API: request", {
            reqId,
            ua: req.headers["user-agent"],
            ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            bodyKeys: Object.keys(req.body || {}),
        });

        const { idToken } = req.body || {};
        if (!idToken) {
            logError("login API: missing idToken", { reqId });
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });
        }

        const decoded = await verifyFirebaseIdToken(idToken);
        const firebaseUid: string = (decoded.user_id as string) || (decoded.uid as string);
        if (!firebaseUid) {
            logError("login API: decoded token missing uid", { reqId, decodedKeys: Object.keys(decoded || {}) });
            return res.status(400).json({ code: "BAD_TOKEN", message: "Invalid token: no uid", body: null });
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
            code: "OK",
            message: "Login success",
            body: {
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
            },
        });
    } catch (error: any) {
        logError("login API: exception", {
            reqId,
            name: error?.name,
            code: error?.code,
            message: error?.message,
            stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
            firebaseError: error?.errorInfo || undefined,
            responseData: error?.response?.data || undefined,
            status: error?.status,
        });

        const upstream = isUpstreamUnavailable(error);
        const status =
            typeof error?.status === "number"
                ? error.status
                : typeof error?.response?.status === "number"
                ? error.response.status
                : undefined;
        const isClientError = !upstream && status !== undefined && status >= 400 && status < 500;

        const httpStatus = upstream ? 503 : isClientError ? 400 : 500;
        const responseCode = upstream
            ? "UPSTREAM_UNAVAILABLE"
            : typeof error?.code === "string"
            ? error.code.toUpperCase()
            : isClientError
            ? "BAD_REQUEST"
            : "LOGIN_FAILED";
        const message = upstream
            ? error?.message || "Upstream unavailable"
            : error?.message || "Login failed";

        res.setHeader("x-req-id", reqId);
        return res.status(httpStatus).json({ code: responseCode, message, body: null });
    }
}

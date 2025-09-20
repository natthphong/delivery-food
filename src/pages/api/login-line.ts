export const config = { runtime: 'nodejs' }
import type { NextApiRequest, NextApiResponse } from "next";
import { verifyLineIdToken } from "@/utils/lineVerify";
import { upsertUser } from "@/repository/user";
import { signAccessToken, mintRefreshToken } from "@/utils/jwt";
import { logInfo, logError } from "@/utils/logger";

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
        logInfo("login-line: request", {
            reqId,
            ua: req.headers["user-agent"],
            ip: req.socket.remoteAddress,
            bodyKeys: Object.keys(req.body || {}),
        });

        const { idToken } = req.body || {};
        if (!idToken) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });
        }

        const payload = await verifyLineIdToken(idToken);
        const lineUid = payload.sub;
        const email = payload.email || null;
        const provider = "line";
        const isEmailVerified = !!email;

        const user = await upsertUser({
            firebaseUid: lineUid,
            email,
            phone: null,
            provider,
            isEmailVerified,
            isPhoneVerified: false,
        });

        const accessToken = signAccessToken({ uid: lineUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: lineUid, userId: user.id });

        logInfo("login-line: success", { reqId, userId: user.id });
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
        logError("login-line: exception", {
            reqId,
            message: error?.message,
            code: error?.code,
            stack: process.env.NODE_ENV !== "production" ? error?.stack : undefined,
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

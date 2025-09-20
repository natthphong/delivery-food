import type { NextApiRequest, NextApiResponse } from "next";
import { verifyLineIdToken } from "@/utils/lineVerify";
import { upsertUser } from "@/repository/user";
import { signAccessToken, mintRefreshToken } from "@/utils/jwt";
import { logInfo, logError } from "@/utils/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const reqId = Math.random().toString(36).slice(2, 8);
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        logInfo("login-line: request", {
            reqId, ua: req.headers["user-agent"], ip: req.socket.remoteAddress,
            bodyKeys: Object.keys(req.body || {}),
        });

        const { idToken } = req.body || {};
        if (!idToken) return res.status(400).json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });

        const payload = await verifyLineIdToken(idToken);
        const lineUid = payload.sub;               // LINE user id
        const email = payload.email || null;
        const provider = "line";
        const isEmailVerified = !!email;           // email is trusted if present

        const user = await upsertUser({
            firebaseUid: lineUid, // we can reuse this field as "externalUid" or add a new column if you prefer
            email,
            phone: null,
            provider,
            isEmailVerified,
            isPhoneVerified: false,
        });

        const accessToken = signAccessToken({ uid: lineUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: lineUid, userId: user.id });

        logInfo("login-line: success", { reqId, userId: user.id });
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
    } catch (e: any) {
        logError("login-line: exception", { reqId, message: e?.message, stack: e?.stack });
        return res.status(400).json({ code: "LOGIN_FAILED", message: e?.message || "Login failed", body: null });
    }
}

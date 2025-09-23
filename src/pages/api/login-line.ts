import type { NextApiRequest, NextApiResponse } from "next";
// import { verifyLineIdToken } from "@/utils/lineVerify";
import { getUserByFirebaseUid, upsertUser } from "@/repository/user";
import { signAccessToken, mintRefreshToken } from "@/utils/jwt";
import { logInfo, logError } from "@/utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }

        logInfo("login-line: request", {
            reqId,
            ua: req.headers["user-agent"],
            ip: req.socket.remoteAddress,
            bodyKeys: Object.keys(req.body || {}),
        });

        const { profile } = req.body || {};
        if (!profile) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing profile", body: null });
        }

        // const payload = await verifyLineIdToken(idToken);
        const lineUid = profile.userId;
        const email = typeof profile.email === "string" ? profile.email : null;
        const provider = "line";

        const user = await upsertUser({
            firebaseUid: lineUid,
            email,
            phone: null,
            provider,
            isEmailVerified: false,
            isPhoneVerified: false,
        });

        const freshUser = await getUserByFirebaseUid(lineUid);

        const accessToken = signAccessToken({ uid: lineUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: lineUid, userId: user.id });

        logInfo("login-line: success", { reqId, userId: user.id });
        const responseUser = freshUser ?? user;

        return res.status(200).json({
            code: "OK",
            message: "Login success",
            body: {
                accessToken,
                refreshToken,
                user: responseUser,
            },
        });
    } catch (e: any) {
        logError("login-line: exception", { reqId, message: e?.message, stack: e?.stack });
        return res.status(402).json({ code: "LOGIN_FAILED", message: "Login failed", body: null });
    }
}

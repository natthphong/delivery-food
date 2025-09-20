import type { NextApiRequest, NextApiResponse } from "next";
import { signUpEmailPassword, sendVerifyEmail } from "@utils/firebaseRest";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";
import { upsertUser } from "@repository/user";
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

        const { provider } = req.body || {};
        if (!provider) {
            res.setHeader("x-req-id", reqId);
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing provider", body: null });
        }

        logInfo("signup:request", { reqId, provider, bodyKeys: Object.keys(req.body || {}) });

        let idToken: string | null = null;

        if (provider === "password") {
            const { email, password, sendVerifyEmail: wantVerify } = req.body || {};
            if (!email || !password) {
                res.setHeader("x-req-id", reqId);
                return res.status(400).json({ code: "BAD_REQUEST", message: "Missing email or password", body: null });
            }

            const out = await signUpEmailPassword({ email, password });
            idToken = out.idToken;

            if (wantVerify) {
                try {
                    await sendVerifyEmail(idToken);
                    logInfo("signup:sent_verify_email", { reqId, email });
                } catch (e: any) {
                    logError("signup:send_verify_email_failed", { reqId, message: e?.message });
                }
            }
        } else if (provider === "google" || provider === "phone") {
            idToken = req.body?.idToken;
            if (!idToken) {
                res.setHeader("x-req-id", reqId);
                return res
                    .status(400)
                    .json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });
            }
        } else {
            res.setHeader("x-req-id", reqId);
            return res.status(400).json({ code: "BAD_REQUEST", message: "Unsupported provider", body: null });
        }

        const decoded = await verifyFirebaseIdToken(idToken!);
        const firebaseUid: string = (decoded.user_id as string) || (decoded.uid as string);
        if (!firebaseUid) {
            res.setHeader("x-req-id", reqId);
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid token", body: null });
        }

        const email = (decoded.email as string) || null;
        const phone = (decoded.phone_number as string) || null;
        const signInProvider = (decoded.firebase && (decoded.firebase as any).sign_in_provider) || provider;
        const isEmailVerified = !!decoded.email_verified || signInProvider === "google.com";
        const isPhoneVerified = !!phone;

        logInfo("signup:upsert", {
            reqId,
            firebaseUid,
            signInProvider,
            emailPresent: !!email,
            phonePresent: !!phone,
        });

        const user = await upsertUser({
            firebaseUid,
            email,
            phone,
            provider: signInProvider,
            isEmailVerified,
            isPhoneVerified,
        });

        const accessToken = signAccessToken({ uid: firebaseUid, userId: user.id });
        const refreshToken = mintRefreshToken({ uid: firebaseUid, userId: user.id });

        logInfo("signup:success", { reqId, userId: user.id, provider: signInProvider });
        res.setHeader("x-req-id", reqId);
        return res.status(200).json({
            code: "OK",
            message: "Signup success",
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
        logError("signup:exception", {
            reqId,
            name: e?.name,
            code: e?.code,
            message: e?.message,
            data: e?.response?.data,
        });
        res.setHeader("x-req-id", reqId);
        return res.status(400).json({ code: "SIGNUP_FAILED", message: "Signup failed", body: null });
    }
}

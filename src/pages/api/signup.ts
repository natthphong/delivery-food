// src/pages/api/signup.ts
export const config = { runtime: 'nodejs' }
import type { NextApiRequest, NextApiResponse } from "next";
import { signUpEmailPassword, sendVerifyEmail } from "@utils/firebaseRest";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";
import { upsertUser } from "@repository/user";
import { signAccessToken, mintRefreshToken } from "@utils/jwt";
import { logInfo, logError } from "@utils/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const reqId = Math.random().toString(36).slice(2, 8);
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { provider } = req.body || {};
        if (!provider) return res.status(400).json({ error: "Missing provider" });

        logInfo("signup:request", { reqId, provider, bodyKeys: Object.keys(req.body || {}) });

        let idToken: string | null = null;

        if (provider === "password") {
            const { email, password, sendVerifyEmail: wantVerify } = req.body || {};
            if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

            // 1) Firebase create
            const out = await signUpEmailPassword({ email, password });
            idToken = out.idToken;

            // 2) Optionally trigger verify email
            if (wantVerify) {
                try {
                    await sendVerifyEmail(idToken);
                    logInfo("signup:sent_verify_email", { reqId, email });
                } catch (e: any) {
                    logError("signup:send_verify_email_failed", { reqId, message: e?.message });
                }
            }
        } else if (provider === "google" || provider === "phone") {
            // For Google or Phone: client should send idToken received from Firebase client
            idToken = req.body?.idToken;
            if (!idToken) return res.status(400).json({ error: "Missing idToken for provider " + provider });
        } else {
            return res.status(400).json({ error: "Unsupported provider" });
        }

        // Common: verify idToken and stamp user
        const decoded = await verifyFirebaseIdToken(idToken!);
        const firebaseUid: string = (decoded.user_id as string) || (decoded.uid as string);
        if (!firebaseUid) return res.status(400).json({ error: "Invalid token: no uid" });

        const email = (decoded.email as string) || null;
        const phone = (decoded.phone_number as string) || null;
        const signInProvider = (decoded.firebase && (decoded.firebase as any).sign_in_provider) || provider;
        const isEmailVerified = !!decoded.email_verified || signInProvider === "google.com";
        const isPhoneVerified = !!phone;

        logInfo("signup:upsert", { reqId, firebaseUid, signInProvider, emailPresent: !!email, phonePresent: !!phone });

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
            message: "Signup success",
            accessToken, refreshToken,
            user: {
                id: user.id, email: user.email, phone: user.phone, provider: user.provider,
                is_email_verified: user.is_email_verified, is_phone_verified: user.is_phone_verified,
            },
        });
    } catch (e: any) {
        logError("signup:exception", {
            reqId, name: e?.name, code: e?.code, message: e?.message, data: e?.response?.data,
        });
        res.setHeader("x-req-id", reqId);
        return res.status(400).json({ error: e?.message || "Signup failed", code: e?.code || "unknown_error", reqId });
    }
}

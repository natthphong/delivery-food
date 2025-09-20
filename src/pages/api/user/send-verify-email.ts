import type { NextApiRequest, NextApiResponse } from "next";
import { sendVerifyEmail } from "@utils/firebaseRest";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
        }
        const { idToken } = req.body || {};
        if (!idToken) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing idToken", body: null });
        }
        await sendVerifyEmail(idToken);
        return res.status(200).json({ code: "OK", message: "Email sent", body: { ok: true } });
    } catch {
        return res
            .status(400)
            .json({ code: "SEND_EMAIL_FAILED", message: "Failed to send verification email", body: null });
    }
}

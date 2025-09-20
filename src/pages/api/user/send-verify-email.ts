import type { NextApiRequest, NextApiResponse } from "next";
import { sendVerifyEmail } from "@utils/firebaseRest";
export const config = { runtime: 'nodejs' }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ error: "Method Not Allowed" });
        }
        const { idToken } = req.body || {};
        if (!idToken) return res.status(400).json({ error: "Missing idToken" });
        await sendVerifyEmail(idToken);
        res.status(200).json({ ok: true });
    } catch (e: any) {
        res.status(400).json({ error: e?.message || "Failed to send verification email" });
    }
}

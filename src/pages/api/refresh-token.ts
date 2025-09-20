// src/pages/api/refresh-token.ts
export const config = { runtime: 'nodejs' }
import type { NextApiRequest, NextApiResponse } from "next";
import { rotateRefreshToken, signAccessToken } from "@/utils/jwt";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res.status(405).json({ error: "Method Not Allowed" });
        }
        const { refreshToken } = req.body || {};
        if (!refreshToken) return res.status(400).json({ error: "Missing refreshToken" });

        const { token: newRefreshToken, payload } = rotateRefreshToken(refreshToken);
        const accessToken = signAccessToken(payload);

        return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
    } catch (e: any) {
        return res.status(400).json({ error: e?.message || "Failed to refresh" });
    }
}

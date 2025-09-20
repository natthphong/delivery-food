import type { NextApiRequest, NextApiResponse } from "next";
import { rotateRefreshToken, signAccessToken } from "@/utils/jwt";

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

        const { refreshToken } = req.body || {};
        if (!refreshToken) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Missing refreshToken", body: null });
        }

        const { token: newRefreshToken, payload } = rotateRefreshToken(refreshToken);
        const accessToken = signAccessToken(payload);

        return res.status(200).json({
            code: "OK",
            message: "Refresh success",
            body: {
                accessToken,
                refreshToken: newRefreshToken,
            },
        });
    } catch {
        return res.status(400).json({ code: "REFRESH_FAILED", message: "Failed to refresh", body: null });
    }
}

// src/utils/authMiddleware.ts
import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { verifyAccessToken } from "@/utils/jwt";

export function withAuth(handler: NextApiHandler) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
        try {
            const auth = req.headers.authorization || "";
            const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
            if (!token) return res.status(401).json({ error: "missing_token" });
            const payload = verifyAccessToken(token);
            (req as any).auth = payload; // { uid, userId }
            return handler(req, res);
        } catch {
            return res.status(401).json({ error: "invalid_token" });
        }
    };
}

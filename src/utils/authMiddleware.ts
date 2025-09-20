import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { verifyAccessToken } from "@/utils/jwt";

type JsonResponse = { code: string; message: string; body: any };

export function withAuth(handler: NextApiHandler) {
    return async (req: NextApiRequest, res: NextApiResponse<JsonResponse>) => {
        try {
            const auth = req.headers.authorization || "";
            const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
            if (!token) {
                return res
                    .status(401)
                    .json({ code: "UNAUTHORIZED", message: "Missing token", body: null });
            }
            const payload = verifyAccessToken(token);
            (req as any).auth = payload; // { uid, userId }
            return handler(req, res);
        } catch {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Invalid token", body: null });
        }
    };
}

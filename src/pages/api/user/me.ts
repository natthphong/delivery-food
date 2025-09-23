import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@utils/authMiddleware";
import { getUserById } from "@repository/user";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res
            .status(405)
            .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: null });
    }

    const { userId } = (req as any).auth || {};
    if (!userId) {
        return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid token", body: null });
    }

    try {
        const user = await getUserById(Number(userId));
        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found", body: null });
        }

        return res.status(200).json({
            code: "OK",
            message: "success",
            body: {
                user: {
                    id: user.id,
                    firebase_uid: user.firebase_uid,
                    email: user.email,
                    phone: user.phone,
                    provider: user.provider,
                    is_email_verified: user.is_email_verified,
                    is_phone_verified: user.is_phone_verified,
                    balance: user.balance,
                    card: user.card,
                    txn_history: user.txn_history,
                    order_history: user.order_history,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
            },
        });
    } catch {
        return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to load user", body: null });
    }
});

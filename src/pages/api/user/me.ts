import type { NextApiRequest, NextApiResponse } from "next";
export const config = { runtime: 'nodejs' }
import { withAuth } from "@utils/authMiddleware";
import { getUserById } from "@repository/user";

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { userId } = (req as any).auth || {};
    if (!userId) {
        return res.status(401).json({ error: "invalid_token" });
    }

    const user = await getUserById(Number(userId));
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
        user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            is_email_verified: user.is_email_verified,
            is_phone_verified: user.is_phone_verified,
        },
    });
});

import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";

export const config = { runtime: "nodejs" };

type JsonResponse = { code: string; message: string; body: any };

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse<JsonResponse>) {
    const auth = (req as any).auth;
    return res.status(200).json({
        code: "OK",
        message: "success",
        body: { message: `Hello user ${auth.userId}` },
    });
});

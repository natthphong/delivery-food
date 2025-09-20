// src/pages/api/hello.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = (req as any).auth; // { uid, userId }
    res.status(200).json({ message: `Hello user ${auth.userId}` });
});

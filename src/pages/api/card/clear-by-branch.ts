import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { clearCardByBranch, getUserByFirebaseUid, getUserById } from "@/repository/user";
import { logError, logInfo } from "@/utils/logger";
import type { UserRecord } from "@/types";

export const config = { runtime: "nodejs" };

type ApiOk<T> = { code: "OK"; message: "success"; body: T };

type ClearRequest = { branchId?: unknown };

type ClearResponse =
    | ApiOk<{ user: UserRecord }>
    | { code: string; message: string; body: { user: UserRecord | null } };

type AuthContext = { uid?: string; userId?: number | null };

function parseBranchId(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === "string" && raw.trim()) {
        const num = Number(raw);
        return Number.isFinite(num) ? num : null;
    }
    return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ClearResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res
            .status(405)
            .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { user: null } });
    }

    try {
        res.setHeader("Cache-Control", "no-store");

        const auth = (req as any).auth as AuthContext;
        if (!auth?.uid) {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Missing token", body: { user: null } });
        }

        const payload = (req.body as ClearRequest) ?? {};
        const branchId = parseBranchId(payload.branchId);
        if (branchId == null) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "Invalid branchId", body: { user: null } });
        }

        const user =
            typeof auth.userId === "number" && Number.isFinite(auth.userId)
                ? await getUserById(auth.userId)
                : await getUserByFirebaseUid(auth.uid);

        if (!user) {
            return res.status(404).json({ code: "NOT_FOUND", message: "User not found", body: { user: null } });
        }

        logInfo("card clear branch", { reqId, userId: user.id, branchId });

        const updatedUser = await clearCardByBranch(user.id, branchId);

        return res.status(200).json({ code: "OK", message: "success", body: { user: updatedUser } });
    } catch (error: any) {
        logError("card clear branch error", { reqId, message: error?.message });
        const code = error?.message === "USER_NOT_FOUND" ? "NOT_FOUND" : "ERROR";
        const statusCode = code === "NOT_FOUND" ? 404 : 500;
        const message = code === "NOT_FOUND" ? "User not found" : "Failed to clear card";
        return res.status(statusCode).json({ code, message, body: { user: null } });
    }
}

export default withAuth(handler);

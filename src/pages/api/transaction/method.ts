import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { listActiveMethods } from "@/repository/transaction";
import { logError, logInfo } from "@/utils/logger";
import type { TransactionMethod } from "@/types/transaction";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type MethodResponse = JsonResponse<{ methods: TransactionMethod[] }>;

function parseCompanyId(value: unknown): number | null {
    if (typeof value === "string" && value.trim()) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse<MethodResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { methods: [] } });
        }

        res.setHeader("Cache-Control", "no-store");

        const companyId = parseCompanyId(req.query.companyId);
        if (companyId == null) {
            return res
                .status(400)
                .json({ code: "BAD_REQUEST", message: "Invalid companyId", body: { methods: [] } });
        }

        logInfo("transaction method: request", { reqId, companyId });

        const methods = await listActiveMethods(companyId);

        return res.status(200).json({ code: "OK", message: "success", body: { methods } });
    } catch (error: any) {
        logError("transaction method: error", { reqId, message: error?.message });
        return res
            .status(500)
            .json({ code: "ERROR", message: "Failed to load methods", body: { methods: [] } });
    }
}

export default withAuth(handler);

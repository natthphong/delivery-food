import type { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/utils/authMiddleware";
import { getSystemConfig } from "@/repository/user";
import { logError, logInfo } from "@/utils/logger";

export const config = { runtime: "nodejs" };

type JsonResponse<T = any> = { code: string; message: string; body: T };

type ConfigResponse = JsonResponse<{ config: Record<string, string> }>;

async function handler(req: NextApiRequest, res: NextApiResponse<ConfigResponse>) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method Not Allowed", body: { config: {} } });
        }

        res.setHeader("Cache-Control", "no-store");

        logInfo("system config: request", { reqId });

        const configMap = await getSystemConfig();

        return res.status(200).json({ code: "OK", message: "success", body: { config: configMap } });
    } catch (error: any) {
        logError("system config: error", {
            reqId,
            message: error?.message,
        });
        return res.status(500).json({ code: "ERROR", message: "Failed to load config", body: { config: {} } });
    }
}

export default withAuth(handler);

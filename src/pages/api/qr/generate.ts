import type { NextApiRequest, NextApiResponse } from "next";
import generatePayload from "promptpay-qr";
import { withAuth } from "@/utils/authMiddleware";
import { getSupabase } from "@/utils/supabaseServer";
import { logError, logInfo } from "@/utils/logger";
import { renderQr } from "@/utils/qrRenderer";
import QRCode from "qrcode";

type Body = { branchId?: number; amount?: number };

async function handler(req: NextApiRequest, res: NextApiResponse) {
    const reqId = Math.random().toString(36).slice(2, 8);

    try {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            return res
                .status(405)
                .json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" });
        }

        res.setHeader("Cache-Control", "no-store");

        const rawBody = typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Body | undefined);
        const branchIdValue = rawBody?.branchId;
        const amountValue = rawBody?.amount;

        const branchId = typeof branchIdValue === "number" ? branchIdValue : Number(branchIdValue);
        if (!branchId || Number.isNaN(branchId)) {
            return res.status(400).json({ code: "BAD_REQUEST", message: "branchId is required" });
        }

        const supabase = getSupabase();

        logInfo("qr/generate: resolving branch", { reqId, branchId });

        const { data: branch, error: branchError } = await supabase
            .from("tbl_branch")
            .select("id, company_id")
            .eq("id", branchId)
            .single();

        if (branchError || !branch) {
            return res.status(404).json({ code: "NOT_FOUND", message: "Branch not found" });
        }

        const { data: company, error: companyError } = await supabase
            .from("tbl_company")
            .select("id, payment_id")
            .eq("id", branch.company_id)
            .single();

        if (companyError || !company?.payment_id) {
            return res.status(400).json({ code: "CONFIG_MISSING", message: "Company payment_id missing" });
        }

        const normalizedAmount =
            typeof amountValue === "number" && Number.isFinite(amountValue)
                ? Math.max(0, Math.round(amountValue * 100) / 100)
                : undefined;

        const payload = generatePayload(
            company.payment_id,
            normalizedAmount ? { amount: normalizedAmount } : undefined
        );

        logInfo("qr/generate: creating png", { reqId, branchId, companyId: branch.company_id, amount: normalizedAmount });

        const png = await QRCode.toBuffer(payload, {
            type: "png",
            errorCorrectionLevel: "M",
            margin: 2,
            scale: 6,
        });

        const wantsJson = (req.headers.accept || "").includes("application/json");
        if (wantsJson) {
            const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
            return res.status(200).json({
                code: "OK",
                message: "success",
                body: { pngDataUrl: dataUrl, payload, amount: normalizedAmount ?? null },
            });
        }

        res.setHeader("Content-Type", "image/png");
        return res.status(200).send(png);
    } catch (error: any) {
        logError("qr/generate: error", { reqId, message: error?.message });
        return res
            .status(500)
            .json({ code: "ERROR", message: error?.message || "QR generation failed" });
    }
}

export default withAuth(handler);

import type { NextApiRequest, NextApiResponse } from "next";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

/** Keep only digits, convert 66XXXXXXXXX → 0XXXXXXXXX for Thai mobile numbers */
function normalizePromptPayId(raw: unknown): string {
    const digits = String(raw ?? "").replace(/\D+/g, "");
    if (!digits) throw new Error("payment_id empty");
    if (/^66\d{9}$/.test(digits)) return `0${digits.slice(2)}`; // 66XXXXXXXXX -> 0XXXXXXXXX
    if (/^0\d{9}$/.test(digits)) return digits;                  // 0XXXXXXXXX
    // Allow other PromptPay targets (13-digit national ID, etc.)
    return digits;
}

/** Round to 2 decimals, clamp >= 0; return undefined if invalid */
function normalizeAmount(raw: unknown): number | undefined {
    if (raw === null || raw === undefined || raw === "") return undefined;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.round(n * 100) / 100);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");
            return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" });
        }

        // Example defaults: same as your CLI test
        const { id = "0943248965", amount = "4.22", emv } = req.query;

        const target = normalizePromptPayId(Array.isArray(id) ? id[0] : id);
        const amt = normalizeAmount(Array.isArray(amount) ? amount[0] : amount);

        // Build EMV payload (same library the CLI uses)
        const payload = generatePayload(target, amt !== undefined ? { amount: amt } : undefined);

        // Optional debug to fetch the EMV string directly: /api/mock/qr?emv=1
        if (String(emv) === "1") {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            return res.status(200).send(payload);
        }

        // Render PNG QR (quiet zone + reasonable scale, good scanner compatibility)
        const png = await QRCode.toBuffer(payload, {
            type: "png",
            errorCorrectionLevel: "M",
            margin: 2,
            scale: 6,
        });

        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Content-Disposition", `inline; filename="promptpay-${target}${amt ? `-${amt.toFixed(2)}` : ""}.png"`);
        return res.status(200).send(png);
    } catch (err: any) {
        return res.status(400).json({ code: "BAD_REQUEST", message: err?.message || "Invalid parameters" });
    }
}

import { logError } from "@/utils/logger";
import { last4Digits } from "@/utils/strings";

export type SlipOkVerifyParams = {
    file: string;
    amount: number;
};

export type SlipOkVerifyResult = {
    ok: boolean;
    code?: string;
    message?: string;
    payload?: any;
};

function pickString(...candidates: Array<string | null | undefined>): string | null {
    for (const candidate of candidates) {
        if (typeof candidate === "string") {
            const trimmed = candidate.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }
    return null;
}

function normalizeTimestamp(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    const raw = String(value).trim();
    if (!raw) {
        return null;
    }

    if (/^\d{10}$/.test(raw)) {
        const seconds = Number(raw);
        return new Date(seconds * 1000).toISOString();
    }

    if (/^\d{13}$/.test(raw)) {
        const ms = Number(raw);
        return new Date(ms).toISOString();
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return `${raw}T00:00:00.000Z`;
    }

    if (raw.includes(" ") && !raw.includes("T")) {
        return raw.replace(" ", "T");
    }

    if (!/Z$|[+\-]\d{2}:?\d{2}$/.test(raw)) {
        return `${raw}Z`;
    }

    return raw;
}

export async function callSlipOkVerify(params: SlipOkVerifyParams): Promise<SlipOkVerifyResult> {
    const url = process.env.NEXT_PUBLIC_SLIP_OK_VERIFY_URL;
    const token = process.env.NEXT_PUBLIC_SLIP_OK_TOKEN;

    if (!url || !token) {
        return { ok: false, code: "CONFIG_MISSING", message: "SlipOK configuration missing" };
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: params.amount,
                file: params.file,
            }),
        });

        const contentType = response.headers.get("content-type");
        let parsed: any = null;
        if (contentType && contentType.includes("application/json")) {
            try {
                parsed = await response.json();
            } catch {
                parsed = null;
            }
        } else {
            try {
                const text = await response.text();
                parsed = text ? JSON.parse(text) : null;
            } catch {
                parsed = null;
            }
        }

        const payload = parsed?.payload ?? parsed?.data ?? parsed;
        const resultCode = pickString(parsed?.code, parsed?.status_code, parsed?.error_code, parsed?.resultCode);
        const resultMessage = pickString(parsed?.message, parsed?.error_message, parsed?.status_desc, parsed?.description);

        const success = (() => {
            if (!response.ok) {
                return false;
            }
            if (typeof parsed?.ok === "boolean") {
                return parsed.ok;
            }
            if (typeof parsed?.status === "string") {
                return ["ok", "success", "verified"].includes(parsed.status.toLowerCase());
            }
            if (typeof parsed?.code === "string") {
                return parsed.code.toUpperCase() === "OK" || parsed.code === "000";
            }
            return response.ok;
        })();

        if (!success) {
            return {
                ok: false,
                code: resultCode ?? (response.status === 400 ? "INVALID_SLIP" : undefined),
                message: resultMessage ?? "Slip verification failed",
                payload,
            };
        }

        return { ok: true, payload, code: resultCode ?? "OK", message: resultMessage ?? "success" };
    } catch (error: any) {
        logError("SlipOK verify request failed", { message: error?.message });
        return { ok: false, code: "INTERNAL_ERROR", message: "Slip verification failed" };
    }
}

export type SlipMeta = {
    transRef: string | null;
    transDate: string | null;
    transTimestamp: string | null;
    receiverLast4: string | null;
};

export function extractSlipMeta(payload: any): SlipMeta {
    if (!payload || typeof payload !== "object") {
        return {
            transRef: null,
            transDate: null,
            transTimestamp: null,
            receiverLast4: null,
        };
    }

    const transRef = pickString(
        (payload as any).transRef,
        (payload as any).trans_ref,
        (payload as any).transactionRef,
        (payload as any).transaction_ref,
        (payload as any).txnRef
    );

    const transDate = pickString(
        (payload as any).transDate,
        (payload as any).trans_date,
        (payload as any).transactionDate,
        (payload as any).txnDate,
        (payload as any).date
    );

    const transTimestamp = normalizeTimestamp(
        pickString(
            (payload as any).transTimestamp,
            (payload as any).trans_timestamp,
            (payload as any).transactionTimestamp,
            (payload as any).transaction_datetime,
            (payload as any).transactionDateTime,
            (payload as any).transferDateTime,
            (payload as any).timestamp,
            (payload as any).paid_at,
            (payload as any).paidAt
        ) ?? (payload as any).transTime ?? (payload as any).trans_time ?? (payload as any).transactionTime
    );

    let receiverCandidate = pickString(
        (payload as any).receiverAccount,
        (payload as any).receiver_account,
        (payload as any).receiverProxy,
        (payload as any).receiver_proxy,
        (payload as any).destinationAccount,
        (payload as any).destination_account,
        (payload as any).accountTo,
        (payload as any).account_to,
        (payload as any).to_account,
        (payload as any).toAccount
    );

    if (!receiverCandidate) {
        const receiver = (payload as any).receiver || (payload as any).destination || null;
        if (receiver && typeof receiver === "object") {
            receiverCandidate = pickString(
                (receiver as any).account,
                (receiver as any).accountNumber,
                (receiver as any).account_no,
                (receiver as any).proxy,
                (receiver as any).proxyId,
                (receiver as any).id,
                (receiver as any).number
            );
            if (!receiverCandidate) {
                for (const value of Object.values(receiver)) {
                    if (typeof value === "string" && last4Digits(value)) {
                        receiverCandidate = value;
                        break;
                    }
                }
            }
        }
    }

    const receiverLast4 = last4Digits(receiverCandidate);

    return {
        transRef: transRef ?? null,
        transDate: transDate ?? null,
        transTimestamp: transTimestamp ?? null,
        receiverLast4: receiverLast4 ?? null,
    };
}

const PROMPTPAY_AID = "A000000677010111";
const COUNTRY_CODE = "TH";
const CURRENCY_THB = "764";
const ID_PAYLOAD_FORMAT = "00";
const ID_POI_METHOD = "01";
const ID_MERCHANT_ACCOUNT = "29";
const ID_TRANSACTION_CURRENCY = "53";
const ID_TRANSACTION_AMOUNT = "54";
const ID_COUNTRY_CODE = "58";
const ID_CRC = "63";

export type PromptpayOptions = {
    amount?: number;
};

function sanitizeDigits(input: string): string {
    return input.replace(/[^0-9A-Za-z]/g, "");
}

function formatField(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
}

function computeCrc16(payload: string): string {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i += 1) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let bit = 0; bit < 8; bit += 1) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xffff;
            } else {
                crc = (crc << 1) & 0xffff;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
}

type MerchantAccount = {
    type: string;
    value: string;
};

function resolveAccount(target: string): MerchantAccount {
    const digits = sanitizeDigits(target);
    if (!digits) {
        throw new Error("PromptPay target is required");
    }

    if (/^[0-9]{10}$/.test(digits) && digits.startsWith("0")) {
        return { type: "01", value: `66${digits.slice(1)}` };
    }

    if (/^[0-9]{13}$/.test(digits)) {
        return { type: "02", value: digits };
    }

    if (/^[0-9]{15}$/.test(digits)) {
        return { type: "03", value: digits };
    }

    return { type: "04", value: digits };
}

export default function generatePayload(target: string, options?: PromptpayOptions): string {
    const merchant = resolveAccount(target);
    const poiMethod = options?.amount != null && Number.isFinite(options.amount) ? "12" : "11";
    const amount =
        options?.amount != null && Number.isFinite(options.amount)
            ? Math.max(0, Math.round(options.amount * 100) / 100)
            : undefined;

    const merchantInfo =
        formatField("00", PROMPTPAY_AID) +
        formatField(merchant.type, merchant.value);

    const segments: string[] = [];
    segments.push(formatField(ID_PAYLOAD_FORMAT, "01"));
    segments.push(formatField(ID_POI_METHOD, poiMethod));
    segments.push(formatField(ID_MERCHANT_ACCOUNT, merchantInfo));
    segments.push(formatField(ID_TRANSACTION_CURRENCY, CURRENCY_THB));
    if (typeof amount === "number") {
        segments.push(formatField(ID_TRANSACTION_AMOUNT, amount.toFixed(2)));
    }
    segments.push(formatField(ID_COUNTRY_CODE, COUNTRY_CODE));

    const withoutCrc = segments.join("") + ID_CRC + "04";
    const crc = computeCrc16(withoutCrc);
    return withoutCrc + crc;
}

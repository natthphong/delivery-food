import type { Locale } from "@/utils/i18n";
import { STATUS_I18N_KEY, TXN_STATUS_I18N, type DisplayStatus, type TxnStatus } from "@/constants/status";

export type LocaleCode = Locale;

const TXN_STATUS_CHIP: Record<TxnStatus, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export const TXN_TYPE = {
    deposit: {
        en: "Deposit",
        th: "เติมเงิน",
    },
    payment: {
        en: "Payment",
        th: "ชำระเงิน",
    },
} as const;

export const METHOD_TYPE = {
    qr: {
        en: "QR Slip",
        th: "โอน/สลิป",
    },
    balance: {
        en: "Wallet Balance",
        th: "กระเป๋าเงิน",
    },
} as const;

export function humanTxnStatus(status: TxnStatus | "expired", locale: LocaleCode): string {
    return TXN_STATUS_I18N[status]?.[locale] ?? status;
}

export function chipClassForTxnStatus(status: TxnStatus): string {
    const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ";
    const chip = TXN_STATUS_CHIP[status] ?? "border-slate-200 bg-slate-100 text-slate-700";
    return base + chip;
}

export function humanTxnType(type: keyof typeof TXN_TYPE, locale: LocaleCode): string {
    return TXN_TYPE[type]?.[locale] ?? type;
}

export function humanMethodType(type: keyof typeof METHOD_TYPE, locale: LocaleCode): string {
    return METHOD_TYPE[type]?.[locale] ?? type;
}

export function humanOrderStatus(status: DisplayStatus, locale: LocaleCode): string {
    return STATUS_I18N_KEY[status]?.[locale] ?? status;
}

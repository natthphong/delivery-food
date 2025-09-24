import type { Locale } from "@/utils/i18n";

export type LocaleCode = Locale;

export const TXN_STATUS = {
    pending: {
        en: "Pending",
        th: "รอดำเนินการ",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
    },
    accepted: {
        en: "Accepted",
        th: "สำเร็จ",
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    rejected: {
        en: "Rejected",
        th: "ถูกปฏิเสธ",
        chip: "bg-rose-50 text-rose-700 border-rose-200",
    },
} as const;

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

export const ORDER_STATUS = {
    PENDING: {
        en: "Pending",
        th: "รอดำเนินการ",
    },
    PREPARE: {
        en: "Preparing",
        th: "กำลังเตรียม",
    },
    DELIVERY: {
        en: "Delivering",
        th: "กำลังจัดส่ง",
    },
    COMPLETED: {
        en: "Completed",
        th: "สำเร็จ",
    },
    REJECTED: {
        en: "Rejected",
        th: "ถูกปฏิเสธ",
    },
} as const;

export function humanTxnStatus(status: keyof typeof TXN_STATUS, locale: LocaleCode): string {
    return TXN_STATUS[status]?.[locale] ?? status;
}

export function chipClassForTxnStatus(status: keyof typeof TXN_STATUS): string {
    const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ";
    const chip = TXN_STATUS[status]?.chip ?? "border-slate-200 bg-slate-100 text-slate-700";
    return base + chip;
}

export function humanTxnType(type: keyof typeof TXN_TYPE, locale: LocaleCode): string {
    return TXN_TYPE[type]?.[locale] ?? type;
}

export function humanMethodType(type: keyof typeof METHOD_TYPE, locale: LocaleCode): string {
    return METHOD_TYPE[type]?.[locale] ?? type;
}

export function humanOrderStatus(status: keyof typeof ORDER_STATUS, locale: LocaleCode): string {
    return ORDER_STATUS[status]?.[locale] ?? status;
}

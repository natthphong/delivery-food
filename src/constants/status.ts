import type { OrderRow, OrderStatus, TxnStatus as CoreTxnStatus } from "@/types/transaction";
import { isExpiredUTC } from "@/utils/time";

export type DisplayStatus =
    | "PENDING"
    | "PREPARE"
    | "DELIVERY"
    | "COMPLETED"
    | "REJECTED"
    | "EXPIRED";

export const STATUS_I18N_KEY: Record<DisplayStatus, { en: string; th: string }> = {
    PENDING: { en: "Awaiting payment", th: "รอการชำระเงิน" },
    PREPARE: { en: "Preparing", th: "กำลังทำอาหาร" },
    DELIVERY: { en: "On the way", th: "กำลังจัดส่ง" },
    COMPLETED: { en: "Completed", th: "สำเร็จ" },
    REJECTED: { en: "Rejected", th: "ถูกปฏิเสธ" },
    EXPIRED: { en: "Expired", th: "หมดอายุ" },
};

export type TxnStatus = CoreTxnStatus;

export const TXN_STATUS_I18N: Record<TxnStatus | "expired", { en: string; th: string }> = {
    pending: { en: "Pending", th: "รอดำเนินการ" },
    accepted: { en: "Accepted", th: "สำเร็จ" },
    rejected: { en: "Rejected", th: "ถูกปฏิเสธ" },
    expired: { en: "Expired", th: "หมดอายุ" },
};

type TxnInput = {
    status: CoreTxnStatus;
    expired_at?: string | null;
} | null;

export function deriveDisplayStatus(
    order: Pick<OrderRow, "status"> | { status: OrderStatus | DisplayStatus },
    txn?: TxnInput
): DisplayStatus {
    if (txn?.status === "rejected") {
        return "REJECTED";
    }
    if (txn?.status === "pending" && isExpiredUTC(txn.expired_at)) {
        return "EXPIRED";
    }
    const status = order.status as DisplayStatus;
    return status ?? "PENDING";
}

export const TXN_STATUS_LABEL = {
  en: { pending: "Pending", accepted: "Accepted", rejected: "Rejected", expired: "Expired" },
  th: { pending: "รอดำเนินการ", accepted: "สำเร็จ", rejected: "ปฏิเสธ", expired: "หมดอายุ" },
} as const;

export const ORDER_STATUS_LABEL = {
  en: {
    PENDING: "Pending",
    PREPARE: "Preparing",
    DELIVERY: "On the way",
    COMPLETED: "Completed",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
  },
  th: {
    PENDING: "รอชำระ/รอรับออเดอร์",
    PREPARE: "กำลังทำอาหาร",
    DELIVERY: "กำลังจัดส่ง",
    COMPLETED: "สำเร็จ",
    REJECTED: "ปฏิเสธ",
    EXPIRED: "หมดอายุ",
  },
} as const;

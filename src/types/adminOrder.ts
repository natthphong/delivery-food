import type { Order } from "@/types/transaction";

export type AdminOrder = Order & {
    customerName?: string | null;
    customerPhone?: string | null;
    paymentMethodName?: string | null;
};

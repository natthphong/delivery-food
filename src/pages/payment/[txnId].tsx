import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import SlipUpload from "@/components/payment/SlipUpload";
import type { OrderRow, TransactionMethod, TransactionRow, TxnStatus, OrderStatus } from "@/types/transaction";
import axios, { type ApiResponse } from "@/utils/apiClient";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import type { I18nKey } from "@/constants/i18nKeys";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";

const QR_REFRESH_INTERVAL = 60_000;

type TxnResponse = ApiResponse<{ txn: TransactionRow | null; method: TransactionMethod | null }>;
type OrderResponse = ApiResponse<{ order: OrderRow | null }>;
type QrResponse = ApiResponse<{ pngDataUrl: string }>;

type TabKey = "qr" | "upload";

const TXN_STATUS_COLORS: Record<TxnStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    accepted: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
};

const TXN_STATUS_LABEL: Record<TxnStatus, I18nKey> = {
    pending: I18N_KEYS.PAYMENT_STATUS_PENDING,
    accepted: I18N_KEYS.PAYMENT_STATUS_ACCEPTED,
    rejected: I18N_KEYS.PAYMENT_STATUS_REJECTED,
};

const ORDER_STATUS_LABEL: Record<OrderStatus, I18nKey> = {
    PENDING: I18N_KEYS.ORDER_STATUS_PENDING,
    PREPARE: I18N_KEYS.ORDER_STATUS_PREPARE,
    DELIVERY: I18N_KEYS.ORDER_STATUS_DELIVERY,
    COMPLETED: I18N_KEYS.ORDER_STATUS_COMPLETED,
    REJECTED: I18N_KEYS.ORDER_STATUS_REJECTED,
};

function StatusChip({ status }: { status: string }) {
    const { t } = useI18n();
    const normalized = status.toLowerCase() as TxnStatus;
    const color = TXN_STATUS_COLORS[normalized] ?? "bg-amber-100 text-amber-800";
    const labelKey = TXN_STATUS_LABEL[normalized] ?? I18N_KEYS.PAYMENT_STATUS_UNKNOWN;
    return (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${color}`}>
            {t(labelKey)}
        </span>
    );
}

export default function PaymentDetailPage() {
    const { t } = useI18n();
    const router = useRouter();
    const { txnId: queryTxnId } = router.query;
    const txnId = useMemo(() => {
        const value = Array.isArray(queryTxnId) ? queryTxnId[0] : queryTxnId;
        if (!value) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }, [queryTxnId]);

    const [txn, setTxn] = useState<TransactionRow | null>(null);
    const [method, setMethod] = useState<TransactionMethod | null>(null);
    const [order, setOrder] = useState<OrderRow | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>("qr");
    const [loading, setLoading] = useState(true);
    const [qrLoading, setQrLoading] = useState(false);

    useEffect(() => {
        if (!txnId) return;
        setLoading(true);
        Promise.all([
            axios.get<TxnResponse>(`/api/transaction/${txnId}`),
            axios.get<OrderResponse>("/api/order/by-transaction", { params: { txnId } }),
        ])
            .then(([txnResponse, orderResponse]) => {
                if (txnResponse.data.code === "OK") {
                    setTxn(txnResponse.data.body?.txn ?? null);
                    setMethod(txnResponse.data.body?.method ?? null);
                }
                if (orderResponse.data.code === "OK") {
                    setOrder(orderResponse.data.body?.order ?? null);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [txnId, t]);

    const shouldShowQr = txn && txn.status === "pending" && method?.type === "qr";

    const fetchQr = () => {
        if (!shouldShowQr || !order || !txn) return;
        setQrLoading(true);
        axios
            .post<QrResponse>("/api/qr/generate", { branchId: order.branch_id, amount: txn.amount })
            .then((response) => {
                if (response.data.code === "OK" && response.data.body?.pngDataUrl) {
                    setQrDataUrl(response.data.body.pngDataUrl);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_QR_ERROR), "error");
            })
            .finally(() => {
                setQrLoading(false);
            });
    };

    useEffect(() => {
        if (!shouldShowQr) return;
        fetchQr();
        const timer = setInterval(fetchQr, QR_REFRESH_INTERVAL);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldShowQr, order?.branch_id, txn?.amount]);

    const handleSlipSuccess = (updatedTxn: TransactionRow) => {
        setTxn(updatedTxn);
        notify(t(I18N_KEYS.PAYMENT_SLIP_SUBMITTED_SUCCESS), "success");
    };

    const statusText = txn ? t(TXN_STATUS_LABEL[txn.status] ?? I18N_KEYS.PAYMENT_STATUS_UNKNOWN) : "";
    const statusLabel = statusText ? t(I18N_KEYS.PAYMENT_STATUS_LABEL, { status: statusText }) : "";

    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="self-start text-xs text-slate-500 hover:text-slate-700"
                    >
                        {t(I18N_KEYS.PAYMENT_BACK)}
                    </button>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        {t(I18N_KEYS.PAYMENT_TITLE, { id: txnId ?? "" })}
                    </h1>
                    {txn ? <StatusChip status={txn.status} /> : null}
                    <p className="text-xs text-slate-500">{statusLabel}</p>
                </header>

                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>
                    </div>
                ) : txn ? (
                    <div className="space-y-6">
                        {shouldShowQr ? (
                            <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_QR_SECTION)}</h2>
                                    <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setTab("qr")}
                                            className={`rounded-xl px-3 py-1 text-xs font-medium transition ${
                                                tab === "qr" ? "bg-white shadow-sm" : "text-slate-500"
                                            }`}
                                            aria-pressed={tab === "qr"}
                                        >
                                            {t(I18N_KEYS.PAYMENT_TAB_QR)}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTab("upload")}
                                            className={`rounded-xl px-3 py-1 text-xs font-medium transition ${
                                                tab === "upload" ? "bg-white shadow-sm" : "text-slate-500"
                                            }`}
                                            aria-pressed={tab === "upload"}
                                        >
                                            {t(I18N_KEYS.PAYMENT_TAB_UPLOAD)}
                                        </button>
                                    </div>
                                </div>
                                {tab === "qr" ? (
                                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                        {qrLoading ? (
                                            <p className="text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_QR_LOADING)}</p>
                                        ) : qrDataUrl ? (
                                            <img src={qrDataUrl} alt={t(I18N_KEYS.PAYMENT_QR_ALT)} className="h-64 w-64 rounded-2xl border border-slate-200" />
                                        ) : (
                                            <p className="text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_QR_EMPTY)}</p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={fetchQr}
                                            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                        >
                                            {t(I18N_KEYS.PAYMENT_QR_REFRESH)}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <SlipUpload txnId={txn.id} onSuccess={handleSlipSuccess} />
                                    </div>
                                )}
                            </section>
                        ) : null}

                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_SUMMARY_TITLE)}</h2>
                            <dl className="mt-4 space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between">
                                    <dt>{t(I18N_KEYS.PAYMENT_SUMMARY_AMOUNT)}</dt>
                                    <dd>{formatTHB(txn.amount)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>{t(I18N_KEYS.PAYMENT_SUMMARY_STATUS)}</dt>
                                    <dd>{statusText}</dd>
                                </div>
                                {method ? (
                                    <div className="flex justify-between">
                                        <dt>{t(I18N_KEYS.PAYMENT_SUMMARY_METHOD)}</dt>
                                        <dd>{method.name}</dd>
                                    </div>
                                ) : null}
                            </dl>
                        </section>

                        {order ? (
                            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_ORDER_TITLE)}</h2>
                                <p className="text-xs text-slate-500">{order.order_details.branchName}</p>
                                <p className="text-xs text-slate-500">
                                    {t(ORDER_STATUS_LABEL[order.status] ?? I18N_KEYS.ORDER_STATUS_PENDING)}
                                </p>
                                <ul className="mt-4 space-y-3">
                                    {order.order_details.productList.map((item, index) => {
                                        const addOnTotal = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
                                        const total = (item.price + addOnTotal) * item.qty;
                                        return (
                                            <li key={`${item.productId}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800">{item.productName}</p>
                                                        <p className="text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_ITEM_QTY, { qty: item.qty })}</p>
                                                        {item.productAddOns.length > 0 && (
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {item.productAddOns
                                                                    .map((addon) => `${addon.name} (+${formatTHB(addon.price)})`)
                                                                    .join(", ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-900">{formatTHB(total)}</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ) : null}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_DETAIL_ERROR)}</p>
                    </div>
                )}
            </div>
        </Layout>
    );
}

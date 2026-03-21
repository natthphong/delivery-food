import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import generatePromptPayPayload from "promptpay-qr";
import Layout from "@components/Layout";
import SlipUpload from "@/components/payment/SlipUpload";
import Preparing from "@/components/order/Preparing";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { fetchTransactionDetail } from "@/services/payment";
import type { TransactionDetail } from "@/types/transaction";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";

const OrderLocationMap = dynamic(() => import("@/components/order/LocationMap"), { ssr: false });

function formatDate(value: string | null, locale: string) {
    if (!value) return null;
    try {
        return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

export default function PaymentDetailPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t, locale } = useI18n();
    const [detail, setDetail] = useState<TransactionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const txnId = useMemo(() => {
        const raw = Array.isArray(router.query.txnId) ? router.query.txnId[0] : router.query.txnId;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }, [router.query.txnId]);

    useEffect(() => {
        if (!txnId) return;
        setLoading(true);
        fetchTransactionDetail(txnId)
            .then((payload) => {
                setDetail(payload);
                if (payload.user) {
                    dispatch(setUser(payload.user));
                }
            })
            .catch((error: any) => {
                notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                setDetail(null);
            })
            .finally(() => setLoading(false));
    }, [dispatch, t, txnId]);

    useEffect(() => {
        const promptPayId = detail?.transaction.method?.promptPayId;
        const amount = detail?.transaction.amount;
        if (!promptPayId || !amount || detail?.transaction.status !== "pending" || detail.transaction.method?.methodType !== "qr") {
            setQrDataUrl(null);
            return;
        }
        const payload = generatePromptPayPayload(promptPayId, { amount });
        void QRCode.toDataURL(payload, { width: 440, margin: 1 })
            .then(setQrDataUrl)
            .catch(() => setQrDataUrl(null));
    }, [detail]);

    const transaction = detail?.transaction ?? null;
    const order = detail?.order ?? null;
    const isQrPending = transaction?.status === "pending" && transaction.method?.methodType === "qr";
    const isPreparing = order?.status === "PREPARE";

    return (
        <Layout>
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#14532d_55%,#86efac_130%)] px-6 py-7 text-white shadow-xl">
                    <button type="button" onClick={() => router.back()} className="text-xs text-emerald-100/90">
                        {t(I18N_KEYS.PAYMENT_BACK)}
                    </button>
                    <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
                        {transaction ? `Transaction #${transaction.id}` : t(I18N_KEYS.DETAIL_PAYMENT_NO)}
                    </h1>
                    {transaction ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-emerald-50">
                            <span className="rounded-full bg-white/10 px-3 py-1">{transaction.txnType.toUpperCase()}</span>
                            <span className="rounded-full bg-white/10 px-3 py-1">{transaction.status.toUpperCase()}</span>
                            <span>{formatTHB(transaction.amount)}</span>
                        </div>
                    ) : null}
                </header>

                {loading ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                        {t(I18N_KEYS.COMMON_LOADING)}
                    </div>
                ) : !transaction ? (
                    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
                        {t(I18N_KEYS.PAYMENT_DETAIL_ERROR)}
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
                        <div className="space-y-6">
                            {isQrPending ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_QR_SECTION)}</h2>
                                    <p className="mt-1 text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_QR_CREATED)}</p>
                                    <div className="mt-4 rounded-[2rem] bg-slate-50 p-5">
                                        {qrDataUrl ? (
                                            <img src={qrDataUrl} alt="PromptPay QR" className="mx-auto w-full max-w-sm rounded-3xl bg-white p-4 shadow-sm" />
                                        ) : (
                                            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                                                Unable to render QR
                                            </div>
                                        )}
                                    </div>
                                    {transaction.expiresAt ? (
                                        <p className="mt-4 text-xs text-slate-500">
                                            {t(I18N_KEYS.DETAIL_EXPIRES_AT)}: {formatDate(transaction.expiresAt, locale)}
                                        </p>
                                    ) : null}
                                </section>
                            ) : null}

                            {transaction.method?.methodType === "qr" && transaction.status === "pending" ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_SLIP_LABEL)}</h2>
                                    <p className="mt-1 text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_SLIP_HINT)}</p>
                                    <div className="mt-4">
                                        <SlipUpload
                                            txnId={transaction.id}
                                            onSuccess={(nextDetail) => {
                                                setDetail(nextDetail);
                                                if (nextDetail.user) {
                                                    dispatch(setUser(nextDetail.user));
                                                }
                                            }}
                                        />
                                    </div>
                                </section>
                            ) : null}

                            {order ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-base font-semibold text-slate-900">Order #{order.id}</h2>
                                            <p className="text-sm text-slate-500">{order.branch?.name ?? "Delivery order"}</p>
                                        </div>
                                        {isPreparing ? <Preparing /> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{order.status}</span>}
                                    </div>
                                    <ul className="mt-4 space-y-3">
                                        {order.items.map((item) => (
                                            <li key={item.id} className="rounded-2xl bg-slate-50 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                        <p className="mt-1 text-xs text-slate-500">Qty {item.quantity}</p>
                                                        {item.addOns.length > 0 ? (
                                                            <p className="mt-1 text-xs text-slate-500">{item.addOns.map((addOn) => addOn.name).join(", ")}</p>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-sm font-semibold text-emerald-600">{formatTHB(item.lineTotal)}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ) : null}
                        </div>

                        <aside className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-base font-semibold text-slate-900">Payment summary</h2>
                                <div className="mt-4 space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Method</span>
                                        <span>{transaction.method?.name ?? "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Created</span>
                                        <span>{formatDate(transaction.createdAt, locale)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Amount</span>
                                        <span className="font-semibold text-slate-900">{formatTHB(transaction.amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Status</span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                            {transaction.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {order?.branch && (order.deliveryLat != null || order.deliveryLng != null) ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-slate-900">Delivery route</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {order.deliveryDistanceKm ? `${order.deliveryDistanceKm.toFixed(2)} km` : "Route preview"}
                                    </p>
                                    <div className="mt-4 overflow-hidden rounded-3xl">
                                        <OrderLocationMap
                                            branch={{ lat: order.branch.lat, lng: order.branch.lng }}
                                            customer={{ lat: order.deliveryLat, lng: order.deliveryLng }}
                                        />
                                    </div>
                                </section>
                            ) : null}
                        </aside>
                    </div>
                )}
            </div>
        </Layout>
    );
}

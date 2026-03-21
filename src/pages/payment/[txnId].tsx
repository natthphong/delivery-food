import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Layout from "@components/Layout";
import Preparing from "@/components/order/Preparing";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { fetchTransactionDetail, retryTransactionPayment } from "@/services/payment";
import type { Order, TransactionDetail, TxnStatus } from "@/types/transaction";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";
import { parseApiError } from "@/utils/apiErrors";

const OrderLocationMap = dynamic(() => import("@/components/order/LocationMap"), { ssr: false });

function formatDate(value: string | null | undefined, locale: string) {
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

function statusBadgeClass(status: TxnStatus | "expired") {
    switch (status) {
    case "accepted":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
        return "border-rose-200 bg-rose-50 text-rose-700";
    case "expired":
        return "border-amber-200 bg-amber-50 text-amber-700";
    default:
        return "border-slate-200 bg-slate-100 text-slate-700";
    }
}

function orderStatusLabel(order: Order, t: ReturnType<typeof useI18n>["t"]) {
    switch (order.status) {
    case "PREPARE":
        return t(I18N_KEYS.ORDER_STATUS_PREPARE);
    case "READY":
        return t(I18N_KEYS.ORDER_STATUS_READY);
    case "DELIVERY":
        return t(I18N_KEYS.ORDER_STATUS_DELIVERY);
    case "COMPLETED":
        return t(I18N_KEYS.ORDER_STATUS_COMPLETED);
    case "REJECTED":
        return t(I18N_KEYS.ORDER_STATUS_REJECTED);
    default:
        return t(I18N_KEYS.ORDER_STATUS_PENDING);
    }
}

function transactionTypeLabel(type: "payment" | "deposit", t: ReturnType<typeof useI18n>["t"]) {
    return type === "deposit" ? t(I18N_KEYS.PAYMENT_TYPE_DEPOSIT) : t(I18N_KEYS.PAYMENT_TYPE_PAYMENT);
}

export default function PaymentDetailPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t, locale } = useI18n();
    const [detail, setDetail] = useState<TransactionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState(false);

    const txnId = useMemo(() => {
        const raw = Array.isArray(router.query.txnId) ? router.query.txnId[0] : router.query.txnId;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }, [router.query.txnId]);

    const loadDetail = useCallback(async (silent = false) => {
        if (!txnId) return;
        if (!silent) setLoading(true);
        try {
            const payload = await fetchTransactionDetail(txnId);
            setDetail(payload);
            if (payload.user) {
                dispatch(setUser(payload.user));
            }
        } catch (error: any) {
            if (!silent) {
                notify(parseApiError(error, t(I18N_KEYS.PAYMENT_DETAIL_ERROR)).message, "error");
                setDetail(null);
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [dispatch, t, txnId]);

    useEffect(() => {
        void loadDetail(false);
    }, [loadDetail]);

    useEffect(() => {
        if (!txnId || !detail?.transaction || detail.transaction.status !== "pending" || detail.transaction.isExpired) {
            return;
        }
        const intervalId = window.setInterval(() => {
            void loadDetail(true);
        }, 10000);
        return () => window.clearInterval(intervalId);
    }, [detail?.transaction, loadDetail, txnId]);

    const transaction = detail?.transaction ?? null;
    const order = detail?.order ?? null;
    const qrImageUrl = typeof transaction?.paymentAction?.qrImageUrl === "string" ? transaction.paymentAction.qrImageUrl : null;
    const authorizeUri = typeof transaction?.paymentAction?.authorizeUri === "string" ? transaction.paymentAction.authorizeUri : null;
    const providerStatus = transaction?.providerStatus ?? (typeof transaction?.paymentAction?.providerStatus === "string" ? transaction.paymentAction.providerStatus : null);
    const isPending = transaction?.status === "pending";
    const isExpired = transaction?.status === "expired" || transaction?.isExpired;
    const isGatewayPending = isPending && !!transaction?.paymentAction && (transaction.paymentAction.type === "gateway_qr" || transaction.method?.methodType === "gateway");
    const canRetry = !!transaction && transaction.txnType === "payment" && (transaction.status === "expired" || transaction.status === "rejected");

    const transactionStatusLabel = useMemo(() => {
        switch (transaction?.status) {
        case "accepted":
            return t(I18N_KEYS.PAYMENT_STATUS_ACCEPTED);
        case "rejected":
            return t(I18N_KEYS.PAYMENT_STATUS_REJECTED);
        case "expired":
            return t(I18N_KEYS.PAYMENT_STATUS_EXPIRED);
        case "pending":
            return t(I18N_KEYS.PAYMENT_STATUS_PENDING);
        default:
            return t(I18N_KEYS.PAYMENT_STATUS_UNKNOWN);
        }
    }, [t, transaction?.status]);

    const handleRetry = async () => {
        if (!transaction) return;
        try {
            setRetrying(true);
            const payload = await retryTransactionPayment(transaction.id, { paymentMethodId: transaction.paymentMethodId });
            notify(t(I18N_KEYS.PAYMENT_CREATED_SUCCESS), "success");
            await router.replace(`/payment/${payload.transaction.id}`);
        } catch (error: any) {
            notify(parseApiError(error, t(I18N_KEYS.PAYMENT_DETAIL_ERROR)).message, "error");
        } finally {
            setRetrying(false);
        }
    };

    return (
        <Layout>
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="rounded-[2rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_44%),linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-6 py-7 shadow-sm">
                    <button type="button" onClick={() => router.back()} className="text-xs font-medium text-emerald-700">
                        {t(I18N_KEYS.PAYMENT_BACK)}
                    </button>
                    <h1 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">
                        {transaction ? `${t(I18N_KEYS.DETAIL_PAYMENT_NO)} #${transaction.id}` : t(I18N_KEYS.DETAIL_PAYMENT_NO)}
                    </h1>
                    {transaction ? (
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(transaction.status)}`}>
                                {transactionStatusLabel}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                {transactionTypeLabel(transaction.txnType, t)}
                            </span>
                            <span className="text-base font-semibold text-slate-950">{formatTHB(transaction.amount)}</span>
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
                            {isExpired ? (
                                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-amber-900">{t(I18N_KEYS.PAYMENT_EXPIRED_TITLE)}</h2>
                                    <p className="mt-2 text-sm text-amber-800">{t(I18N_KEYS.PAYMENT_EXPIRED_SUBTITLE)}</p>
                                    {transaction.expiresAt ? (
                                        <p className="mt-3 text-xs text-amber-900/80">
                                            {t(I18N_KEYS.DETAIL_EXPIRES_AT)}: {formatDate(transaction.expiresAt, locale)}
                                        </p>
                                    ) : null}
                                    {canRetry ? (
                                        <button
                                            type="button"
                                            onClick={() => void handleRetry()}
                                            disabled={retrying}
                                            className="mt-4 inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {retrying ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_RETRY)}
                                        </button>
                                    ) : null}
                                </section>
                            ) : null}

                            {isGatewayPending ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_QR_SECTION)}</h2>
                                            <p className="mt-1 text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_PROVIDER_QR_HINT)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void loadDetail(false)}
                                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                        >
                                            {t(I18N_KEYS.PAYMENT_QR_REFRESH)}
                                        </button>
                                    </div>
                                    <div className="mt-4 rounded-[2rem] border border-emerald-100 bg-emerald-50/60 p-5">
                                        {qrImageUrl ? (
                                            <img
                                                src={qrImageUrl}
                                                alt={t(I18N_KEYS.PAYMENT_QR_ALT)}
                                                className="mx-auto w-full max-w-sm rounded-3xl bg-white p-4 shadow-sm"
                                            />
                                        ) : (
                                            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                                                {t(I18N_KEYS.PAYMENT_QR_RENDER_ERROR)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                        {transaction.expiresAt ? (
                                            <span>
                                                {t(I18N_KEYS.DETAIL_EXPIRES_AT)}: {formatDate(transaction.expiresAt, locale)}
                                            </span>
                                        ) : null}
                                        {providerStatus ? (
                                            <span>
                                                {t(I18N_KEYS.PAYMENT_PROVIDER_STATUS_LABEL)}: {providerStatus}
                                            </span>
                                        ) : null}
                                    </div>
                                    {authorizeUri ? (
                                        <a
                                            href={authorizeUri}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-4 inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                                        >
                                            {t(I18N_KEYS.PAYMENT_OPEN_PROVIDER)}
                                        </a>
                                    ) : null}
                                </section>
                            ) : null}

                            {!isExpired && transaction.status !== "accepted" && !isGatewayPending ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.COMMON_STATUS)}</h2>
                                    <p className="mt-2 text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_NOT_PAYABLE)}</p>
                                    {canRetry ? (
                                        <button
                                            type="button"
                                            onClick={() => void handleRetry()}
                                            disabled={retrying}
                                            className="mt-4 inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {retrying ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_RETRY)}
                                        </button>
                                    ) : null}
                                </section>
                            ) : null}

                            {order ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-base font-semibold text-slate-900">
                                                {t(I18N_KEYS.PAYMENT_ORDER_NUMBER)} #{order.id}
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                {order.branch?.name ?? t(I18N_KEYS.PAYMENT_ORDER_FALLBACK_BRANCH)} · {" "}
                                                {order.fulfillmentMode === "rider_delivery" ? t(I18N_KEYS.CHECKOUT_DELIVERY_TITLE) : t(I18N_KEYS.CHECKOUT_PICKUP_TITLE)}
                                            </p>
                                        </div>
                                        {order.status === "PREPARE" ? (
                                            <Preparing />
                                        ) : (
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {orderStatusLabel(order, t)}
                                            </span>
                                        )}
                                    </div>
                                    <ul className="mt-4 space-y-3">
                                        {order.items.map((item) => {
                                            const addOns = Array.isArray(item.addOns) ? item.addOns : [];
                                            return (
                                                <li key={item.id} className="rounded-2xl bg-slate-50 p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {t(I18N_KEYS.CHECKOUT_ITEM_QTY)} {item.quantity}
                                                            </p>
                                                            {addOns.length > 0 ? (
                                                                <p className="mt-1 text-xs text-slate-500">{addOns.map((addOn) => addOn.name).join(", ")}</p>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-sm font-semibold text-emerald-600">{formatTHB(item.lineTotal)}</p>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <div className="mt-4 grid gap-2 text-sm text-slate-500">
                                        <p>{t(I18N_KEYS.PAYMENT_DELIVERY_FEE)}: {formatTHB(order.deliveryFee || 0)}</p>
                                        <p>{t(I18N_KEYS.PAYMENT_CUSTOMER_NOTE)}: {order.customerNote || "-"}</p>
                                        <p>{t(I18N_KEYS.PAYMENT_RIDER_JOB)}: {order.deliveryJob?.status || t(I18N_KEYS.PAYMENT_RIDER_UNASSIGNED)}</p>
                                        {order.deliveryJob?.assignedRiderName ? (
                                            <p>{t(I18N_KEYS.PAYMENT_ASSIGNED_RIDER)}: {order.deliveryJob.assignedRiderName}</p>
                                        ) : null}
                                    </div>
                                </section>
                            ) : null}
                        </div>

                        <aside className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_SUMMARY_TITLE)}</h2>
                                <div className="mt-4 space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_SUMMARY_METHOD)}</span>
                                        <span className="text-slate-900">{transaction.method?.name ?? "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_CREATED_LABEL)}</span>
                                        <span className="text-right text-slate-900">{formatDate(transaction.createdAt, locale)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_SUMMARY_AMOUNT)}</span>
                                        <span className="font-semibold text-slate-900">{formatTHB(transaction.amount)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_SUMMARY_STATUS)}</span>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(transaction.status)}`}>
                                            {transactionStatusLabel}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_PROVIDER_STATUS_LABEL)}</span>
                                        <span className="text-right text-slate-900">{providerStatus || "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">{t(I18N_KEYS.PAYMENT_PAID_AT_LABEL)}</span>
                                        <span className="text-right text-slate-900">{formatDate(transaction.paidAt || null, locale) || "-"}</span>
                                    </div>
                                    {transaction.expiresAt ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-500">{t(I18N_KEYS.DETAIL_EXPIRES_AT)}</span>
                                            <span className="text-right text-slate-900">{formatDate(transaction.expiresAt, locale)}</span>
                                        </div>
                                    ) : null}
                                </div>
                                {transaction.failedReason ? (
                                    <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        {transaction.failedReason}
                                    </div>
                                ) : null}
                                {canRetry ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleRetry()}
                                        disabled={retrying}
                                        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {retrying ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_RETRY)}
                                    </button>
                                ) : null}
                            </section>

                            {order?.branch && order.deliveryLat != null && order.deliveryLng != null ? (
                                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_ROUTE_TITLE)}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {order.deliveryDistanceKm ? `${order.deliveryDistanceKm.toFixed(2)} km` : t(I18N_KEYS.PAYMENT_ROUTE_PREVIEW)}
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

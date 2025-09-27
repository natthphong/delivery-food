import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Layout from "@components/Layout";
import SlipUpload from "@/components/payment/SlipUpload";
import Preparing from "@/components/order/Preparing";
import type { OrderRow, TransactionMethod, TransactionRow, TxnStatus } from "@/types/transaction";
import axios, { type ApiResponse } from "@/utils/apiClient";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { formatTHB } from "@/utils/currency";
import { notify } from "@/utils/notify";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";
import { saveUser } from "@/utils/tokenStorage";
import {
    METHOD_TYPE,
    TXN_TYPE,
    chipClassForTxnStatus,
    humanMethodType,
    humanTxnStatus,
    humanTxnType,
} from "@/constants/statusMaps";
import { formatInBangkok } from "@/utils/datetime";
import {
    STATUS_I18N_KEY,
    type DisplayStatus,
    deriveDisplayStatus,
} from "@/constants/status";

const LongdoRoute = dynamic(() => import("@/components/order/LongdoRoute"), { ssr: false });

const QR_REFRESH_INTERVAL = 60_000;

type TxnResponse = ApiResponse<{ txn: TransactionRow | null; method: TransactionMethod | null }>;
type OrderResponse = ApiResponse<{ order: OrderRow | null }>;
type QrResponse = ApiResponse<{ pngDataUrl: string; payload?: string; amount?: number | null }>;
type UserEnvelope = { user?: any };

type OrderTxnSummary = {
    id: number;
    status: TxnStatus;
    expired_at: string | null;
    isExpired: boolean;
};

type OrderDetailEntry = {
    id: number;
    status: OrderRow["status"];
    displayStatus: DisplayStatus;
    created_at: string;
    updated_at: string;
    order_details: OrderRow["order_details"];
    branch: {
        id: number;
        name: string;
        address: string | null;
        lat: number | null;
        lng: number | null;
    } | null;
    txn: OrderTxnSummary | null;
};

type OrderDetailsResponse = ApiResponse<{ orders: OrderDetailEntry[] }>;

type TabKey = "qr" | "upload";

function parseNumberParam(value: string | string[] | undefined): number | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

export default function PaymentDetailPage() {
    const { t, locale } = useI18n();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { txnId: queryTxnId, mode: queryMode, branchId: queryBranchId } = router.query;
    const txnId = useMemo(() => {
        const value = Array.isArray(queryTxnId) ? queryTxnId[0] : queryTxnId;
        if (!value) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }, [queryTxnId]);
    const depositMode = useMemo(() => {
        const raw = Array.isArray(queryMode) ? queryMode[0] : queryMode;
        return raw === "deposit";
    }, [queryMode]);
    const depositBranchId = useMemo(() => parseNumberParam(queryBranchId), [queryBranchId]);

    const [txn, setTxn] = useState<TransactionRow | null>(null);
    const [method, setMethod] = useState<TransactionMethod | null>(null);
    const [order, setOrder] = useState<OrderRow | null>(null);
    const [orderDetailEntry, setOrderDetailEntry] = useState<OrderDetailEntry | null>(null);
    const [orderDetailLoading, setOrderDetailLoading] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>("qr");
    const [loading, setLoading] = useState(true);
    const [qrLoading, setQrLoading] = useState(false);

    useEffect(() => {
        if (!txnId) return;
        setLoading(true);
        const requests: Array<Promise<void>> = [];

        requests.push(
            axios
                .get<TxnResponse>(`/api/transaction/${txnId}`)
                .then((txnResponse) => {
                    if (txnResponse.data.code === "OK") {
                        setTxn(txnResponse.data.body?.txn ?? null);
                        setMethod(txnResponse.data.body?.method ?? null);
                    } else {
                        setTxn(null);
                        setMethod(null);
                        notify(txnResponse.data.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                    }
                })
                .catch((error) => {
                    setTxn(null);
                    setMethod(null);
                    notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                })
        );

        if (!depositMode) {
            requests.push(
                axios
                    .get<OrderResponse>("/api/order/by-transaction", { params: { txnId } })
                    .then((orderResponse) => {
                        if (orderResponse.data.code === "OK") {
                            setOrder(orderResponse.data.body?.order ?? null);
                        } else {
                            setOrder(null);
                        }
                    })
                    .catch((error) => {
                        setOrder(null);
                        notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                    })
            );
        } else {
            setOrder(null);
        }

        Promise.all(requests)
            .catch(() => {
                // errors handled individually
            })
            .finally(() => {
                setLoading(false);
            });
    }, [depositMode, t, txnId]);

    useEffect(() => {
        if (depositMode) {
            setOrderDetailEntry(null);
            setOrderDetailLoading(false);
            return;
        }
        if (!order?.id) {
            setOrderDetailEntry(null);
            return;
        }
        setOrderDetailLoading(true);
        axios
            .post<OrderDetailsResponse>("/api/order/details", { ids: [order.id] })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.orders)) {
                    setOrderDetailEntry(response.data.body.orders[0] ?? null);
                } else {
                    setOrderDetailEntry(null);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                setOrderDetailEntry(null);
            })
            .finally(() => {
                setOrderDetailLoading(false);
            });
    }, [depositMode, order?.id, t]);

    const shouldShowQr = Boolean(txn && txn.status === "pending" && method?.type === "qr");

    const fetchQr = useCallback(() => {
        if (!shouldShowQr || !txn) return;
        const baseBranchId = depositMode
            ? depositBranchId && depositBranchId > 0
                ? depositBranchId
                : 1
            : order?.branch_id ?? null;
        if (!baseBranchId) return;
        setQrLoading(true);
        axios
            .post<QrResponse>("/api/qr/generate", { branchId: baseBranchId, amount: txn.amount })
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
    }, [depositBranchId, depositMode, order?.branch_id, shouldShowQr, t, txn]);

    useEffect(() => {
        if (!shouldShowQr) return;
        fetchQr();
        const timer = setInterval(fetchQr, QR_REFRESH_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchQr, shouldShowQr]);

    const handleSlipSuccess = (updatedTxn: TransactionRow) => {
        setTxn(updatedTxn);
        notify(t(I18N_KEYS.PAYMENT_SLIP_SUBMITTED_SUCCESS), "success");
    };

    const refreshUser = useCallback(async () => {
        try {
            const response = await axios.get<ApiResponse<UserEnvelope>>("/api/user/me");
            if (response.data.code === "OK" && response.data.body?.user) {
                dispatch(setUser(response.data.body.user));
                saveUser(response.data.body.user);
            }
        } catch {
            // ignore refresh errors
        }
    }, [dispatch]);

    const statusTrackerRef = useRef<string | null>(null);

    useEffect(() => {
        const currentStatus = txn?.status ?? null;
        if (!currentStatus) return;
        if (statusTrackerRef.current === currentStatus) return;
        if (depositMode && currentStatus === "accepted") {
            refreshUser();
            notify(t(I18N_KEYS.DEPOSIT_SUCCESS), "success");
        }
        statusTrackerRef.current = currentStatus;
    }, [depositMode, refreshUser, t, txn?.status]);

    const normalizedStatus = txn ? (txn.status as TxnStatus) : null;
    const normalizedType = txn ? (txn.txn_type as keyof typeof TXN_TYPE) : null;
    const statusLabel = normalizedStatus ? humanTxnStatus(normalizedStatus, locale) : "";
    const statusChipClass = chipClassForTxnStatus((normalizedStatus ?? "pending") as TxnStatus);
    const typeLabel = normalizedType ? humanTxnType(normalizedType, locale) : "";
    const expiresAt = txn?.expired_at ? formatInBangkok(txn.expired_at, locale) : null;
    const createdAt = txn?.created_at ? formatInBangkok(txn.created_at, locale) : null;
    const methodTypeLabel = method ? humanMethodType(method.type as keyof typeof METHOD_TYPE, locale) : "";
    const paymentLabel = t(I18N_KEYS.DETAIL_PAYMENT_NO);
    const depositLabel = t(I18N_KEYS.DETAIL_DEPOSIT_NO);
    const headerTitle = txn
        ? `${depositMode ? depositLabel : paymentLabel} #${txn.id}`
        : txnId
        ? `${paymentLabel} #${txnId}`
        : paymentLabel;
    const localeKey = locale === "th" ? "th" : "en";
    const displayStatus: DisplayStatus | null = !depositMode && order
        ? orderDetailEntry
            ? orderDetailEntry.displayStatus
            : deriveDisplayStatus(order, txn ? { status: txn.status, expired_at: txn.expired_at } : undefined)
        : null;
    const displayStatusLabel = displayStatus ? STATUS_I18N_KEY[displayStatus][localeKey] : null;
    const showPreparing = displayStatus === "PREPARE";
    const orderBranchName = order?.order_details.branchName ?? "";
    const orderCreatedAt = orderDetailEntry?.created_at ?? order?.created_at ?? null;
    const orderCreatedLabel = orderCreatedAt ? formatInBangkok(orderCreatedAt, locale) : null;
    const orderProducts = orderDetailEntry?.order_details.productList ?? order?.order_details.productList ?? [];
    const deliveryInfo = !depositMode
        ? orderDetailEntry?.order_details.delivery ?? order?.order_details.delivery ?? null
        : null;
    const deliveryCoords =
        deliveryInfo &&
        typeof deliveryInfo.lat === "number" &&
        Number.isFinite(deliveryInfo.lat) &&
        typeof deliveryInfo.lng === "number" &&
        Number.isFinite(deliveryInfo.lng)
            ? { lat: Number(deliveryInfo.lat), lng: Number(deliveryInfo.lng) }
            : null;
    const branchCoords = !depositMode && order?.order_details
        ? (() => {
              const rawLat = order.order_details.branchLat;
              const rawLng = order.order_details.branchLng;
              if (rawLat == null || rawLng == null) {
                  return null;
              }
              const lat = Number(rawLat);
              const lng = Number(rawLng);
              return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
          })()
        : null;
    const googleMapsHref = deliveryCoords
        ? `https://www.google.com/maps?q=${deliveryCoords.lat},${deliveryCoords.lng}`
        : null;
    const shouldShowRoute = Boolean(
        !depositMode &&
            order &&
            branchCoords &&
            deliveryCoords &&
            order.status !== "REJECTED" &&
            order.status !== "COMPLETED" &&
            orderDetailEntry?.txn?.status === "accepted"
    );

    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="self-start text-xs text-slate-500 hover:text-slate-700"
                    >
                        {t(I18N_KEYS.PAYMENT_BACK)}
                    </button>
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-semibold text-slate-900">{headerTitle}</h1>
                        {txn ? (
                            <>
                                <p className="text-sm text-slate-600">
                                    {t(I18N_KEYS.DETAIL_TYPE_LABEL)}: {typeLabel}
                                </p>
                                <p className="text-sm text-slate-600 flex items-center gap-2">
                                    {t(I18N_KEYS.DETAIL_STATUS_LABEL)}:
                                    <span className={statusChipClass}>{statusLabel}</span>
                                </p>
                                {expiresAt ? (
                                    <p className="text-xs text-slate-500">
                                        {t(I18N_KEYS.DETAIL_EXPIRES_AT)}: {expiresAt}
                                    </p>
                                ) : null}
                            </>
                        ) : null}
                    </div>
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
                                    <dd>{statusLabel}</dd>
                                </div>
                                {createdAt ? (
                                    <div className="flex justify-between">
                                        <dt>{t(I18N_KEYS.DETAIL_CREATED_AT)}</dt>
                                        <dd>{createdAt}</dd>
                                    </div>
                                ) : null}
                                {method ? (
                                    <div className="flex justify-between text-right">
                                        <dt>{t(I18N_KEYS.PAYMENT_SUMMARY_METHOD)}</dt>
                                        <dd className="space-y-0.5">
                                            <span className="block">{method.name}</span>
                                            <span className="block text-xs text-slate-500">{methodTypeLabel}</span>
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>
                        </section>

                        {!depositMode && order ? (
                            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_ORDER_TITLE)}</h2>
                                    {orderDetailLoading ? (
                                        <span className="text-[11px] text-slate-400">{t(I18N_KEYS.COMMON_LOADING)}</span>
                                    ) : null}
                                </div>
                                <p className="text-xs text-slate-500">{orderBranchName}</p>
                                {displayStatusLabel ? (
                                    <p className="text-xs text-slate-500">{displayStatusLabel}</p>
                                ) : null}
                                {showPreparing ? <Preparing /> : null}
                                {orderCreatedLabel ? (
                                    <p className="text-xs text-slate-400">{orderCreatedLabel}</p>
                                ) : null}
                                <ul className="mt-4 space-y-3">
                                    {orderProducts.map((item, index) => {
                                        const addOnTotal = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
                                        const total = (item.price + addOnTotal) * item.qty;
                                        return (
                                            <li key={`${item.productId}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800">{item.productName}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {t(I18N_KEYS.CHECKOUT_ITEM_QTY)}
                                                            {item.qty}
                                                        </p>
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
                                {!depositMode && (deliveryInfo || branchCoords) ? (
                                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        {shouldShowRoute && branchCoords && deliveryCoords ? (
                                            <div className="overflow-hidden rounded-2xl">
                                                <LongdoRoute
                                                    apiKey={process.env.NEXT_PUBLIC_LONG_DO_API_KEY ?? ""}
                                                    branch={branchCoords}
                                                    customer={deliveryCoords}
                                                    show={true}
                                                />
                                            </div>
                                        ) : null}
                                        {googleMapsHref ? (
                                            <a
                                                className="text-xs text-blue-600 underline"
                                                href={googleMapsHref}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {t(I18N_KEYS.PAYMENT_ROUTE_OPEN_MAPS)}
                                            </a>
                                        ) : (
                                            <p className="text-xs text-slate-500">
                                                {t(I18N_KEYS.PAYMENT_ROUTE_MISSING_CUSTOMER)}
                                            </p>
                                        )}
                                    </div>
                                ) : null}
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

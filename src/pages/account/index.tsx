import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setUser } from "@store/authSlice";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import type { TransactionRow, OrderRow, TransactionMethod, TxnStatus } from "@/types/transaction";
import { signInWithPhoneNumber, signOut } from "firebase/auth";
import { clearTokens, clearUser, saveUser } from "@utils/tokenStorage";
import { useRouter } from "next/router";
import ProfileCard from "@/components/account/ProfileCard";
import VerifyUpdateCard from "@/components/account/VerifyUpdateCard";
import type { Me } from "@/components/account/types";
import type { I18nKey } from "@/constants/i18nKeys";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { TXN_TYPE, chipClassForTxnStatus, humanTxnStatus, humanTxnType } from "@/constants/statusMaps";
import { formatInBangkok } from "@/utils/datetime";
import {
    STATUS_I18N_KEY,
    type DisplayStatus,
    deriveDisplayStatus,
} from "@/constants/status";

import type { ConfirmationResult } from "firebase/auth";

type AccountUpdatePayload = {
    email?: string | null;
    phone?: string | null;
    is_email_verified?: boolean | null;
    is_phone_verified?: boolean | null;
};

type UserEnvelope = { user?: any };

type AccountUpdateResponse = ApiResponse<UserEnvelope>;
type SendVerifyEmailResponse = ApiResponse<{ ok: boolean }>;

type MessageState = { key: I18nKey } | { text: string } | null;

function normalizeUser(payload: any | null | undefined): Me {
    return {
        id: typeof payload?.id === "number" ? payload.id : 0,
        email: payload?.email ?? null,
        phone: payload?.phone ?? null,
        provider: payload?.provider ?? null,
        is_email_verified: Boolean(payload?.is_email_verified),
        is_phone_verified: Boolean(payload?.is_phone_verified),
    };
}

const emptyUser = normalizeUser(null);
type TabKey = "profile" | "transactions" | "orders";
type TransactionDetails = TransactionRow & {
    isExpired: boolean;
    method: Pick<TransactionMethod, "id" | "code" | "name" | "type"> | null;
    order: OrderRow | null;
};

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

export default function AccountPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t, locale } = useI18n();
    const authUser = useSelector((state: RootState) => state.auth.user);
    const resolveErrorMessage = useCallback(
        (error: any, fallbackKey: I18nKey) => {
            const code = error?.response?.data?.code;
            if (code === "DUPLICATE_EMAIL") {
                return t(I18N_KEYS.ACCOUNT_DUPLICATE_EMAIL);
            }
            if (code === "DUPLICATE_PHONE") {
                return t(I18N_KEYS.ACCOUNT_DUPLICATE_PHONE);
            }
            const responseMessage = error?.response?.data?.message ?? error?.message;
            if (typeof responseMessage === "string" && responseMessage.length > 0) {
                return responseMessage;
            }
            return t(fallbackKey);
        },
        [t]
    );
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<MessageState>(null);
    const [error, setError] = useState<MessageState>(null);

    const [newEmail, setNewEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");

    const [updatingEmail, setUpdatingEmail] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [confirmingOtp, setConfirmingOtp] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>("profile");
    const [txnLoading, setTxnLoading] = useState(false);
    const [txnDetails, setTxnDetails] = useState<TransactionDetails[]>([]);
    const [ordersData, setOrdersData] = useState<OrderDetailEntry[] | null>(null);
    const [orderLoading, setOrderLoading] = useState(false);

    const confirmRef = useRef<ConfirmationResult | null>(null);

    const resolvedMessage = useMemo(() => {
        if (!message) return "";
        return "key" in message ? t(message.key) : message.text;
    }, [message, t]);

    const resolvedError = useMemo(() => {
        if (!error) return "";
        return "key" in error ? t(error.key) : error.text;
    }, [error, t]);

    const sortedTransactions = useMemo(() => {
        return [...txnDetails].sort((a, b) => {
            const aTime = Date.parse(a.created_at);
            const bTime = Date.parse(b.created_at);
            return bTime - aTime;
        });
    }, [txnDetails]);

    const fallbackOrders = useMemo<OrderDetailEntry[]>(() => {
        return txnDetails
            .filter((item) => item.order)
            .map((item) => {
                const order = item.order as OrderRow;
                const txn: OrderTxnSummary = {
                    id: item.id,
                    status: item.status,
                    expired_at: item.expired_at,
                    isExpired: item.isExpired,
                };
                return {
                    id: order.id,
                    status: order.status,
                    displayStatus: deriveDisplayStatus(order, txn),
                    created_at: order.created_at,
                    updated_at: order.updated_at,
                    order_details: order.order_details,
                    branch: null,
                    txn,
                };
            });
    }, [txnDetails]);

    const ordersToRender = useMemo(() => ordersData ?? fallbackOrders, [ordersData, fallbackOrders]);

    const sortedOrders = useMemo(() => {
        return [...ordersToRender].sort((a, b) => {
            const aTime = Date.parse(a.created_at);
            const bTime = Date.parse(b.created_at);
            return bTime - aTime;
        });
    }, [ordersToRender]);

    const fetchMe = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get<ApiResponse<UserEnvelope>>("/api/user/me");
            if (r.data.code !== "OK") {
                throw new Error(r.data.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR));
            }
            const user = r.data.body?.user;
            if (!user) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
            }
            setMe(normalizeUser(user));
            dispatch(setUser(user));
            saveUser(user);
            setError(null);
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR);
            setError({ text: messageText });
            setMe(null);
        } finally {
            setLoading(false);
        }
    }, [dispatch, t]);

    useEffect(() => {
        fetchMe().catch(() => {});
    }, [fetchMe]);

    useEffect(() => {
        if (!router.isReady) return;
        const raw = router.query.tab;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (value === "transactions" || value === "orders" || value === "profile") {
            setActiveTab(value);
        }
    }, [router.isReady, router.query.tab]);

    useEffect(() => {
        const history = authUser?.txn_history ?? [];
        if (!history || history.length === 0) {
            setTxnDetails([]);
            setTxnLoading(false);
            return;
        }
        setTxnLoading(true);
        axios
            .post<ApiResponse<{ txns: TransactionDetails[] }>>("/api/transaction/details", { ids: history })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.txns)) {
                    setTxnDetails(response.data.body.txns);
                } else {
                    setTxnDetails([]);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                setTxnDetails([]);
            })
            .finally(() => {
                setTxnLoading(false);
            });
    }, [authUser?.txn_history, t]);

    useEffect(() => {
        const history = authUser?.order_history ?? [];
        if (!history || history.length === 0) {
            setOrdersData([]);
            setOrderLoading(false);
            return;
        }
        const ids = history.slice(0, 100);
        setOrderLoading(true);
        axios
            .post<OrderDetailsResponse>("/api/order/details", { ids })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.orders)) {
                    setOrdersData(response.data.body.orders);
                } else {
                    setOrdersData([]);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
            })
            .finally(() => {
                setOrderLoading(false);
            });
    }, [authUser?.order_history, t]);

    async function updateAccount(patch: AccountUpdatePayload) {
        const response = await axios.post<AccountUpdateResponse>("/api/v1/account/update", patch);
        if (response.data.code !== "OK") {
            throw new Error(response.data.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_FAILED));
        }
        const user = response.data.body?.user;
        if (!user) {
            throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
        }
        setMe(normalizeUser(user));
        dispatch(setUser(user));
        saveUser(user);
    }

    async function handleVerifyEmail() {
        setError(null);
        setMessage(null);
        try {
            if (!auth.currentUser) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
            }
            setVerifyingEmail(true);
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                await updateAccount({ is_email_verified: true });
                setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED });
                notify(t(I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED), "success");
            } else {
                const idToken = await auth.currentUser.getIdToken();
                const response = await axios.post<SendVerifyEmailResponse>("/api/user/send-verify-email", { idToken });
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || t(I18N_KEYS.ACCOUNT_ERROR_VERIFY_EMAIL));
                }
                setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT });
                notify(t(I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT), "info");
            }
        } catch (e: any) {
            const messageText = resolveErrorMessage(e, I18N_KEYS.ACCOUNT_ERROR_PROCESS_EMAIL);
            setError({ text: messageText });
            notify(messageText, "error");
        } finally {
            setVerifyingEmail(false);
        }
    }

    async function handleChangeEmail() {
        setError(null);
        setMessage(null);
        try {
            const trimmed = newEmail.trim();
            if (!trimmed) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NEW_EMAIL_REQUIRED));
            }
            if (!auth.currentUser) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
            }
            if (me?.is_email_verified && trimmed !== (me.email ?? null)) {
                const confirmMessage = t(I18N_KEYS.ACCOUNT_RESET_VERIFY_CONFIRM);
                if (!window.confirm(confirmMessage)) {
                    return;
                }
            }
            setUpdatingEmail(true);
            await updateAccount({ email: trimmed });
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_UPDATED });
            notify(t(I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_UPDATED), "success");
            setNewEmail("");
        } catch (e: any) {
            const messageText = resolveErrorMessage(e, I18N_KEYS.ACCOUNT_ERROR_UPDATE_EMAIL);
            setError({ text: messageText });
            notify(messageText, "error");
        } finally {
            setUpdatingEmail(false);
        }
    }

    async function handleSendOtp() {
        setError(null);
        setMessage(null);
        try {
            const trimmed = phone.trim();
            if (!trimmed) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_PHONE_REQUIRED));
            }
            if (me?.is_phone_verified && trimmed !== (me.phone ?? null)) {
                const confirmMessage = t(I18N_KEYS.ACCOUNT_RESET_VERIFY_CONFIRM);
                if (!window.confirm(confirmMessage)) {
                    return;
                }
            }
            setSendingOtp(true);
            if (trimmed !== (me?.phone ?? "")) {
                await updateAccount({ phone: trimmed, is_phone_verified: false });
            }
            const verifier = makeRecaptcha("btn-send-otp");
            const confirmation = await signInWithPhoneNumber(auth, trimmed, verifier);
            confirmRef.current = confirmation;
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_OTP_SENT });
            notify(t(I18N_KEYS.ACCOUNT_MESSAGE_OTP_SENT), "info");
            setOtp("");
        } catch (e: any) {
            const messageText = resolveErrorMessage(e, I18N_KEYS.ACCOUNT_ERROR_SEND_OTP);
            setError({ text: messageText });
            notify(messageText, "error");
        } finally {
            setSendingOtp(false);
        }
    }

    async function handleConfirmOtp() {
        setError(null);
        setMessage(null);
        try {
            const confirmation = confirmRef.current;
            if (!confirmation) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_OTP_SESSION));
            }
            const code = otp.trim();
            if (!code) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_ENTER_OTP));
            }
            setConfirmingOtp(true);
            await confirmation.confirm(code);
            const trimmedPhone = phone.trim();
            await updateAccount({ phone: trimmedPhone || null, is_phone_verified: true });
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_PHONE_VERIFIED });
            notify(t(I18N_KEYS.ACCOUNT_MESSAGE_PHONE_VERIFIED), "success");
            setPhone("");
            setOtp("");
            confirmRef.current = null;
        } catch (e: any) {
            const messageText = resolveErrorMessage(e, I18N_KEYS.ACCOUNT_ERROR_CONFIRM_OTP);
            setError({ text: messageText });
            notify(messageText, "error");
        } finally {
            setConfirmingOtp(false);
        }
    }

    async function handleLogout() {
        await signOut(auth).catch(() => {});
        dispatch(logout());
        clearTokens();
        clearUser();
        router.replace("/login");
    }

    const safeUser = me ?? emptyUser;

    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">{t(I18N_KEYS.ACCOUNT_TITLE)}</h1>
                    <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_SUBTITLE)}</p>
                </div>

                <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("profile")}
                        className={`rounded-xl px-4 py-2 text-xs font-medium transition ${
                            activeTab === "profile" ? "bg-white shadow-sm" : "text-slate-500"
                        }`}
                        aria-pressed={activeTab === "profile"}
                    >
                        {t(I18N_KEYS.ACCOUNT_TAB_PROFILE)}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("transactions")}
                        className={`rounded-xl px-4 py-2 text-xs font-medium transition ${
                            activeTab === "transactions" ? "bg-white shadow-sm" : "text-slate-500"
                        }`}
                        aria-pressed={activeTab === "transactions"}
                    >
                        {t(I18N_KEYS.ACCOUNT_TAB_TRANSACTIONS)}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className={`rounded-xl px-4 py-2 text-xs font-medium transition ${
                            activeTab === "orders" ? "bg-white shadow-sm" : "text-slate-500"
                        }`}
                        aria-pressed={activeTab === "orders"}
                    >
                        {t(I18N_KEYS.ACCOUNT_TAB_ORDERS)}
                    </button>
                </div>

                {activeTab === "profile" ? (
                    <div className="space-y-6">
                        <ProfileCard me={safeUser} loading={loading} onLogout={handleLogout} />

                        <VerifyUpdateCard
                            me={me}
                            newEmail={newEmail}
                            setNewEmail={setNewEmail}
                            onResendEmail={handleVerifyEmail}
                            onChangeEmail={handleChangeEmail}
                            phone={phone}
                            setPhone={setPhone}
                            otp={otp}
                            setOtp={setOtp}
                            onSendOtp={handleSendOtp}
                            onConfirmOtp={handleConfirmOtp}
                            verifyingEmail={verifyingEmail}
                            updatingEmail={updatingEmail}
                            sendingOtp={sendingOtp}
                            confirmingOtp={confirmingOtp}
                        />

                        {!!resolvedMessage && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                {resolvedMessage}
                            </div>
                        )}
                        {!!resolvedError && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                {resolvedError}
                            </div>
                        )}
                    </div>
                ) : null}

                {activeTab === "transactions" ? (
                    <section className="space-y-4">
                        {txnLoading ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>
                        ) : sortedTransactions.length === 0 ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_TRANSACTIONS_EMPTY)}</p>
                        ) : (
                            <ul className="space-y-4">
                                {sortedTransactions.map((item) => {
                                    const normalizedType = item.txn_type as keyof typeof TXN_TYPE;
                                    const normalizedStatus = item.status as TxnStatus;
                                    const typeLabel = humanTxnType(normalizedType, locale);
                                    const statusLabel = humanTxnStatus(normalizedStatus, locale);
                                    const chipClass = chipClassForTxnStatus(normalizedStatus);
                                    const createdAt = formatInBangkok(item.created_at, locale);
                                    const expires = item.expired_at ? formatInBangkok(item.expired_at, locale) : null;
                                    const hasExpired = item.status === "pending" && item.isExpired;

                                    return (
                                        <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{formatTHB(item.amount)}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_TYPE)}: {typeLabel}
                                                    </p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                                        {t(I18N_KEYS.DETAIL_STATUS_LABEL)}:
                                                        <span className={chipClass}>{statusLabel}</span>
                                                    </p>
                                                    {hasExpired ? (
                                                        <p className="text-[11px] text-rose-600">
                                                            {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_EXPIRED)}
                                                        </p>
                                                    ) : null}
                                                    {item.method ? (
                                                        <p className="text-xs text-slate-500">
                                                            {item.method.name} ({item.method.code})
                                                        </p>
                                                    ) : null}
                                                    <p className="text-xs text-slate-400">{createdAt}</p>
                                                    {expires ? (
                                                        <p className="text-[11px] text-slate-400">
                                                            {t(I18N_KEYS.DETAIL_EXPIRES_AT)}: {expires}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {item.txn_type === "payment" && item.status === "pending" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`/payment/${item.id}`)}
                                                            className="rounded-xl border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                                        >
                                                            {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_PAY_NOW)}
                                                        </button>
                                                    ) : null}
                                                    {item.status === "accepted" && item.txn_type === "payment" && item.order ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`/payment/${item.id}`)}
                                                            className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                                        >
                                                            {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_VIEW_ORDER)}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                ) : null}

                {activeTab === "orders" ? (
                    <section className="space-y-4">
                        {orderLoading && ordersData == null ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>
                        ) : sortedOrders.length === 0 ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_ORDERS_EMPTY)}</p>
                        ) : (
                            <ul className="space-y-4">
                                {sortedOrders.map((order) => {
                                    const localeKey = locale === "th" ? "th" : "en";
                                    const statusLabel = STATUS_I18N_KEY[order.displayStatus][localeKey];
                                    const createdAt = formatInBangkok(order.created_at, locale);
                                    const txn = order.txn;
                                    const txnId = txn?.id ?? null;
                                    const canPayNow = txn?.status === "pending" && !txn.isExpired;

                                    return (
                                        <li key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {order.order_details.branchName}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{statusLabel}</p>
                                                    <p className="text-xs text-slate-400">{createdAt}</p>
                                                </div>
                                                {txnId ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/payment/${txnId}`)}
                                                        className={`rounded-xl px-3 py-1 text-xs font-medium transition ${
                                                            canPayNow
                                                                ? "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        {canPayNow
                                                            ? t(I18N_KEYS.ACCOUNT_TRANSACTIONS_PAY_NOW)
                                                            : t(I18N_KEYS.ACCOUNT_TRANSACTIONS_VIEW_ORDER)}
                                                    </button>
                                                ) : null}
                                            </div>
                                            <ul className="mt-3 space-y-2 text-xs text-slate-600">
                                                {order.order_details.productList.map((product, index) => (
                                                    <li key={`${product.productId}-${index}`}>
                                                        <span className="font-medium text-slate-700">{product.productName}</span>{" "}
                                                        <span className="text-slate-500">
                                                            {t(I18N_KEYS.CHECKOUT_ITEM_QTY)}
                                                            {product.qty}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                ) : null}
            </div>
        </Layout>
    );
}

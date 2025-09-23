import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setUser } from "@store/authSlice";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import type { TransactionRow, OrderRow, TxnStatus, TxnType, OrderStatus } from "@/types/transaction";
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
type OrderWithTxn = OrderRow & { txn?: TransactionRow | null };

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

const TXN_TYPE_LABEL: Record<TxnType, I18nKey> = {
    deposit: I18N_KEYS.PAYMENT_TYPE_DEPOSIT,
    payment: I18N_KEYS.PAYMENT_TYPE_PAYMENT,
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

export default function AccountPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
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
    const [orderLoading, setOrderLoading] = useState(false);
    const [transactions, setTransactions] = useState<TransactionRow[]>([]);
    const [orders, setOrders] = useState<OrderWithTxn[]>([]);

    const confirmRef = useRef<ConfirmationResult | null>(null);

    const resolvedMessage = useMemo(() => {
        if (!message) return "";
        return "key" in message ? t(message.key) : message.text;
    }, [message, t]);

    const resolvedError = useMemo(() => {
        if (!error) return "";
        return "key" in error ? t(error.key) : error.text;
    }, [error, t]);

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
            setTransactions([]);
            return;
        }
        setTxnLoading(true);
        axios
            .get<ApiResponse<{ transactions: TransactionRow[] }>>("/api/transaction/list", {
                params: { ids: history.join(",") },
            })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.transactions)) {
                    setTransactions(response.data.body.transactions);
                } else {
                    setTransactions([]);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                setTransactions([]);
            })
            .finally(() => {
                setTxnLoading(false);
            });
    }, [authUser?.txn_history, t]);

    useEffect(() => {
        const history = authUser?.order_history ?? [];
        if (!history || history.length === 0) {
            setOrders([]);
            return;
        }
        setOrderLoading(true);
        axios
            .get<ApiResponse<{ orders: OrderWithTxn[] }>>("/api/order/list", {
                params: { ids: history.join(",") },
            })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.orders)) {
                    setOrders(response.data.body.orders);
                } else {
                    setOrders([]);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_DETAIL_ERROR), "error");
                setOrders([]);
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
                        ) : transactions.length === 0 ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_TRANSACTIONS_EMPTY)}</p>
                        ) : (
                            <ul className="space-y-4">
                                {transactions.map((item) => (
                                    <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">{formatTHB(item.amount)}</p>
                                                <p className="text-xs text-slate-500">
                                                    {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_TYPE, {
                                                        type: t(TXN_TYPE_LABEL[item.txn_type] ?? I18N_KEYS.PAYMENT_TYPE_PAYMENT),
                                                    })}
                                                </p>
                                                <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <StatusChip status={item.status} />
                                                {item.txn_type === "payment" && item.status === "pending" ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/payment/${item.id}`)}
                                                        className="rounded-xl border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                                    >
                                                        {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_PAY_NOW)}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}

                {activeTab === "orders" ? (
                    <section className="space-y-4">
                        {orderLoading ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>
                        ) : orders.length === 0 ? (
                            <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_ORDERS_EMPTY)}</p>
                        ) : (
                            <ul className="space-y-4">
                                {orders.map((item) => (
                                    <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {item.order_details.branchName}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {t(ORDER_STATUS_LABEL[item.status] ?? I18N_KEYS.ORDER_STATUS_PENDING)}
                                                </p>
                                                <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                                            </div>
                                            {item.txn && item.txn.status === "pending" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/payment/${item.txn?.id}`)}
                                                    className="rounded-xl border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    {t(I18N_KEYS.ACCOUNT_TRANSACTIONS_PAY_NOW)}
                                                </button>
                                            ) : null}
                                        </div>
                                        <ul className="mt-3 space-y-2 text-xs text-slate-600">
                                            {item.order_details.productList.map((product, index) => (
                                                <li key={`${product.productId}-${index}`}>
                                                    {product.productName} × {product.qty}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ) : null}
            </div>
        </Layout>
    );
}

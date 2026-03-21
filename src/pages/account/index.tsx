import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import Layout from "@components/Layout";
import type { RootState } from "@/store";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { fetchOrders, fetchTransactions, sendVerificationEmail, updateProfile } from "@/services/app";
import type { Order, TransactionSummary } from "@/types/transaction";
import { logoutCustomer } from "@/utils/logout";

type TabKey = "profile" | "transactions" | "orders";

export default function AccountPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t, locale } = useI18n();
    const user = useSelector((state: RootState) => state.auth.user);
    const cart = useSelector((state: RootState) => state.cart.value);
    const [tab, setTab] = useState<TabKey>("profile");
    const [displayName, setDisplayName] = useState(user?.displayName ?? "");
    const [email, setEmail] = useState(user?.email ?? "");
    const [phone, setPhone] = useState(user?.phone ?? "");
    const [saving, setSaving] = useState(false);
    const [sendingVerification, setSendingVerification] = useState(false);
    const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        const currentTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
        if (currentTab === "profile" || currentTab === "transactions" || currentTab === "orders") {
            setTab(currentTab);
        }
    }, [router.query.tab]);

    useEffect(() => {
        setDisplayName(user?.displayName ?? "");
        setEmail(user?.email ?? "");
        setPhone(user?.phone ?? "");
    }, [user?.displayName, user?.email, user?.phone]);

    useEffect(() => {
        if (tab === "transactions") {
            fetchTransactions().then(setTransactions).catch(() => setTransactions([]));
        }
        if (tab === "orders") {
            fetchOrders().then(setOrders).catch(() => setOrders([]));
        }
    }, [tab]);

    const cartSummary = useMemo(
        () => t(I18N_KEYS.ACCOUNT_CART_SUMMARY, { count: cart.totalQuantity }),
        [cart.totalQuantity, t]
    );

    const walletSummary = useMemo(
        () => t(I18N_KEYS.ACCOUNT_WALLET_SUMMARY, { amount: formatTHB(user?.walletBalance ?? 0) }),
        [t, user?.walletBalance]
    );

    const handleSave = async () => {
        try {
            setSaving(true);
            const nextUser = await updateProfile({ displayName, email, phone });
            dispatch(setUser(nextUser));
            notify(t(I18N_KEYS.ACCOUNT_PROFILE_UPDATED), "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_FAILED), "error");
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyEmail = async () => {
        try {
            setSendingVerification(true);
            await sendVerificationEmail(locale);
            notify(t(I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT), "info");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.ACCOUNT_ERROR_VERIFY_EMAIL), "error");
        } finally {
            setSendingVerification(false);
        }
    };

    const formatDate = (value: string) =>
        new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));

    const transactionTypeLabel = (type: "payment" | "deposit") =>
        type === "deposit" ? t(I18N_KEYS.PAYMENT_TYPE_DEPOSIT) : t(I18N_KEYS.PAYMENT_TYPE_PAYMENT);

    const transactionStatusLabel = (status: TransactionSummary["status"]) => {
        switch (status) {
        case "accepted":
            return t(I18N_KEYS.PAYMENT_STATUS_ACCEPTED);
        case "rejected":
            return t(I18N_KEYS.PAYMENT_STATUS_REJECTED);
        case "expired":
            return t(I18N_KEYS.PAYMENT_STATUS_EXPIRED);
        default:
            return t(I18N_KEYS.PAYMENT_STATUS_PENDING);
        }
    };

    const orderStatusLabel = (status: Order["status"]) => {
        switch (status) {
        case "PREPARE":
            return t(I18N_KEYS.ORDER_STATUS_PREPARE);
        case "DELIVERY":
            return t(I18N_KEYS.ORDER_STATUS_DELIVERY);
        case "COMPLETED":
            return t(I18N_KEYS.ORDER_STATUS_COMPLETED);
        case "REJECTED":
            return t(I18N_KEYS.ORDER_STATUS_REJECTED);
        default:
            return t(I18N_KEYS.ORDER_STATUS_PENDING);
        }
    };

    const tabs: Array<{ key: TabKey; label: string }> = [
        { key: "profile", label: t(I18N_KEYS.ACCOUNT_TAB_PROFILE) },
        { key: "transactions", label: t(I18N_KEYS.ACCOUNT_TAB_TRANSACTIONS) },
        { key: "orders", label: t(I18N_KEYS.ACCOUNT_TAB_ORDERS) },
    ];

    return (
        <Layout>
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-[2rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_44%),linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-6 py-8 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                                {t(I18N_KEYS.ACCOUNT_CENTER_EYEBROW)}
                            </p>
                            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
                                {user?.displayName || user?.email || t(I18N_KEYS.ACCOUNT_DEFAULT_NAME)}
                            </h1>
                            <p className="mt-2 text-sm text-slate-600">
                                {walletSummary} · {cartSummary}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void logoutCustomer(dispatch, router)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                        </button>
                    </div>
                </section>

                <div className="flex flex-wrap gap-3">
                    {tabs.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                tab === item.key ? "bg-emerald-500 text-slate-950" : "bg-white text-slate-600 shadow-sm"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === "profile" ? (
                    <section className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_PROFILE_DETAILS)}</h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(I18N_KEYS.ACCOUNT_DISPLAY_NAME)}</span>
                                    <input
                                        value={displayName}
                                        onChange={(event) => setDisplayName(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(I18N_KEYS.ACCOUNT_EMAIL)}</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(I18N_KEYS.ACCOUNT_PHONE)}</span>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </label>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                    className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                                >
                                    {saving ? t(I18N_KEYS.COMMON_UPDATING) : t(I18N_KEYS.ACCOUNT_SAVE_PROFILE)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleVerifyEmail()}
                                    disabled={sendingVerification}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {sendingVerification
                                        ? t(I18N_KEYS.COMMON_SENDING)
                                        : user?.isEmailVerified
                                            ? t(I18N_KEYS.ACCOUNT_REFRESH_EMAIL)
                                            : t(I18N_KEYS.ACCOUNT_SEND_EMAIL)}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_SESSION_WALLET)}</h2>
                            <div className="mt-5 space-y-4 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">{t(I18N_KEYS.ACCOUNT_PROVIDER_LABEL)}</p>
                                    <p className="mt-1 font-semibold text-slate-900">{user?.providerLabel || user?.authProvider || "-"}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">{t(I18N_KEYS.ACCOUNT_WALLET_BALANCE)}</p>
                                    <p className="mt-1 text-2xl font-semibold text-slate-900">{formatTHB(user?.walletBalance ?? 0)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">{t(I18N_KEYS.ACCOUNT_VERIFICATION_STATUS)}</p>
                                    <p className="mt-1 font-semibold text-slate-900">
                                        {t(I18N_KEYS.ACCOUNT_EMAIL)} {user?.isEmailVerified ? t(I18N_KEYS.ACCOUNT_VERIFIED) : t(I18N_KEYS.ACCOUNT_STATUS_PENDING)} ·{" "}
                                        {t(I18N_KEYS.ACCOUNT_PHONE)} {user?.isPhoneVerified ? t(I18N_KEYS.ACCOUNT_VERIFIED) : t(I18N_KEYS.ACCOUNT_STATUS_PENDING)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}

                {tab === "transactions" ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_TAB_TRANSACTIONS)}</h2>
                        <div className="mt-5 space-y-3">
                            {transactions.length === 0 ? (
                                <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_TRANSACTIONS_EMPTY)}</p>
                            ) : (
                                transactions.map((transaction) => (
                                    <button
                                        key={transaction.id}
                                        type="button"
                                        onClick={() => void router.push(`/payment/${transaction.id}`)}
                                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {transactionTypeLabel(transaction.txnType)} · {transaction.method?.name ?? "-"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-900">{formatTHB(transaction.amount)}</p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {transactionStatusLabel(transaction.status)}
                                                {transaction.providerStatus ? ` · ${transaction.providerStatus}` : ""}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                ) : null}

                {tab === "orders" ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_TAB_ORDERS)}</h2>
                        <div className="mt-5 space-y-3">
                            {orders.length === 0 ? (
                                <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_ORDERS_EMPTY)}</p>
                            ) : (
                                orders.map((order) => (
                                    <button
                                        key={order.id}
                                        type="button"
                                        onClick={() => void router.push(`/payment/${order.transactionId}`)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {t(I18N_KEYS.PAYMENT_ORDER_NUMBER)} #{order.id} · {order.branch?.name ?? t(I18N_KEYS.PAYMENT_ORDER_FALLBACK_BRANCH)}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {formatDate(order.createdAt)} · {order.fulfillmentMode === "rider_delivery" ? t(I18N_KEYS.CHECKOUT_DELIVERY_TITLE) : t(I18N_KEYS.CHECKOUT_PICKUP_TITLE)}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {orderStatusLabel(order.status)}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {order.items.slice(0, 3).map((item) => (
                                                <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                                    {item.quantity}x {item.productName}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                                            <p>{t(I18N_KEYS.PAYMENT_DELIVERY_FEE)}: {formatTHB(order.deliveryFee || 0)}</p>
                                            <p>{t(I18N_KEYS.PAYMENT_RIDER_JOB)}: {order.deliveryJob?.status || t(I18N_KEYS.PAYMENT_RIDER_UNASSIGNED)}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                ) : null}
            </div>
        </Layout>
    );
}

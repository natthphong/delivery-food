import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { auth } from "@/utils/firebaseClient";
import { sendEmailVerification, signOut } from "firebase/auth";
import Layout from "@components/Layout";
import type { RootState } from "@/store";
import { useAppDispatch } from "@/store";
import { logout, setUser } from "@/store/authSlice";
import { clearCart as clearCartState, setCart } from "@/store/cartSlice";
import { clearConfig as clearConfigState } from "@/store/configSlice";
import { clearCart, clearConfig, clearTokens, clearUser } from "@/utils/tokenStorage";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { notify } from "@/utils/notify";
import { formatTHB } from "@/utils/currency";
import { fetchOrders, fetchTransactions, updateProfile } from "@/services/app";
import type { Order, TransactionSummary } from "@/types/transaction";

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

    const cartSummary = useMemo(() => `${cart.totalQuantity} items in basket`, [cart.totalQuantity]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const nextUser = await updateProfile({ displayName, email, phone });
            dispatch(setUser(nextUser));
            notify("Profile updated.", "success");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to update profile.", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyEmail = async () => {
        try {
            if (!auth.currentUser) {
                notify(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION), "warning");
                return;
            }
            if (auth.currentUser.emailVerified) {
                const nextUser = await updateProfile({ isEmailVerified: true });
                dispatch(setUser(nextUser));
                notify(t(I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED), "success");
                return;
            }
            await sendEmailVerification(auth.currentUser);
            notify(t(I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT), "info");
        } catch (error: any) {
            notify(error?.message || t(I18N_KEYS.ACCOUNT_ERROR_VERIFY_EMAIL), "error");
        }
    };

    const handleLogout = async () => {
        await signOut(auth).catch(() => undefined);
        dispatch(logout());
        dispatch(clearCartState());
        dispatch(clearConfigState());
        dispatch(setCart({ groups: [], totalAmount: 0, totalItems: 0, totalQuantity: 0, lastSyncedAt: new Date(0).toISOString() }));
        clearTokens();
        clearUser();
        clearCart();
        clearConfig();
        void router.replace("/login");
    };

    const formatDate = (value: string) =>
        new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));

    return (
        <Layout>
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#065f46_50%,#d1fae5_125%)] px-6 py-8 text-white shadow-xl">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Account center</p>
                            <h1 className="mt-3 text-3xl font-semibold">{user?.displayName || user?.email || "Your account"}</h1>
                            <p className="mt-2 text-sm text-emerald-50/85">
                                Wallet {formatTHB(user?.walletBalance ?? 0)} · {cartSummary}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                        >
                            {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                        </button>
                    </div>
                </section>

                <div className="flex flex-wrap gap-3">
                    {(["profile", "transactions", "orders"] as TabKey[]).map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setTab(item)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                tab === item ? "bg-slate-950 text-white" : "bg-white text-slate-600 shadow-sm"
                            }`}
                        >
                            {item === "profile" ? "Profile" : item === "transactions" ? "Transactions" : "Orders"}
                        </button>
                    ))}
                </div>

                {tab === "profile" ? (
                    <section className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Display name</span>
                                    <input
                                        value={displayName}
                                        onChange={(event) => setDisplayName(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </label>
                                <label className="space-y-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
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
                                    {saving ? t(I18N_KEYS.COMMON_UPDATING) : "Save profile"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleVerifyEmail()}
                                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    {user?.isEmailVerified ? "Refresh email verification" : "Send verification email"}
                                </button>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-slate-900">Session and wallet</h2>
                            <div className="mt-5 space-y-4 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">Provider</p>
                                    <p className="mt-1 font-semibold text-slate-900">{user?.providerLabel || user?.authProvider || "-"}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">Wallet balance</p>
                                    <p className="mt-1 text-2xl font-semibold text-slate-900">{formatTHB(user?.walletBalance ?? 0)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-slate-500">Verification</p>
                                    <p className="mt-1 font-semibold text-slate-900">
                                        Email {user?.isEmailVerified ? "verified" : "pending"} · Phone {user?.isPhoneVerified ? "verified" : "pending"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}

                {tab === "transactions" ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
                        <div className="mt-5 space-y-3">
                            {transactions.length === 0 ? (
                                <p className="text-sm text-slate-500">No transactions yet.</p>
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
                                                {transaction.txnType.toUpperCase()} · {transaction.method?.name ?? "Method"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-slate-900">{formatTHB(transaction.amount)}</p>
                                            <p className="mt-1 text-xs text-slate-500">{transaction.status.toUpperCase()}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                ) : null}

                {tab === "orders" ? (
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-900">Orders</h2>
                        <div className="mt-5 space-y-3">
                            {orders.length === 0 ? (
                                <p className="text-sm text-slate-500">No orders yet.</p>
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
                                                    Order #{order.id} · {order.branch?.name ?? "Branch"}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{order.status}</span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {order.items.slice(0, 3).map((item) => (
                                                <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                                    {item.quantity}x {item.productName}
                                                </span>
                                            ))}
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

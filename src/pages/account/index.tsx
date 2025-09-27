/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setUser } from "@store/authSlice";
import { signInWithPhoneNumber, signOut, type ConfirmationResult } from "firebase/auth";
import { clearTokens, clearUser, saveUser } from "@utils/tokenStorage";
import { useRouter } from "next/router";
import ProfileCard from "@/components/account/ProfileCard";
import VerifyUpdateCard from "@/components/account/VerifyUpdateCard";
import type { Me } from "@/components/account/types";
import type { I18nKey } from "@/constants/i18nKeys";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import { notify } from "@/utils/notify";
import Link from "next/link";
import { TXN_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/constants/status";

type Locale = "en" | "th";

type AccountUpdatePayload = {
  email?: string | null;
  phone?: string | null;
  is_email_verified?: boolean | null;
  is_phone_verified?: boolean | null;
};

type UserEnvelope = { user?: any };
type AccountUpdateResponse = ApiResponse<UserEnvelope>;
type OrdersResponse = ApiResponse<{ orders: OrderDto[] }>;
type MessageState = { key: I18nKey } | { text: string } | null;

type OrderDto = {
  id: number;
  status: string;
  displayStatus: string;
  created_at: string | null;
  updated_at: string | null;
  order_details: {
    userId: number;
    branchId: string;
    branchName: string;
    productList: Array<{
      qty: number;
      price: number;
      productId: string;
      productName: string;
      productAddOns?: Array<{ name: string; price: number }>;
    }>;
    delivery?: { lat: number; lng: number; distanceKm?: number };
  };
  branch: { id: number; name: string; address: string | null; lat: number | null; lng: number | null } | null;
  txn: { id: number; status: string; expired_at: string | null; isExpired: boolean } | null;
};

type TransactionItem = {
  id: number;
  status: string | null;
  expired_at: string | null;
  isExpired: boolean;
  latestCreatedAt: string | null;
  orders: Array<{ id: number; status: string; created_at: string | null }>;
};

type TabValue = "details" | "orders" | "transactions";

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

function formatBangkok(input: string | null | undefined, locale: Locale): string {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const formatLocale = locale === "th" ? "th-TH" : "en-US";
  return date.toLocaleString(formatLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
}

function humanOrderStatus(status: string | null | undefined, locale: Locale): string {
  if (!status) return "-";
  const map = ORDER_STATUS_LABEL[locale] || ORDER_STATUS_LABEL.en;
  return map[status as keyof typeof map] || status;
}

function humanTxnStatus(status: string | null | undefined, locale: Locale, isExpired: boolean): string {
  if (isExpired) return (TXN_STATUS_LABEL[locale] || TXN_STATUS_LABEL.en).expired;
  if (!status) return "-";
  const map = TXN_STATUS_LABEL[locale] || TXN_STATUS_LABEL.en;
  return map[status as keyof typeof map] || status;
}

function isValidTab(tab: string | null | undefined): tab is TabValue {
  if (!tab) return false;
  return tab === "details" || tab === "orders" || tab === "transactions";
}

export default function AccountPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { t, locale } = useI18n();
  const loc = (locale as Locale) || "en";

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

  const confirmRef = useRef<ConfirmationResult | null>(null);

  const [activeTab, setActiveTab] = useState<TabValue>("details");
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

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
      if (r.data.code !== "OK") throw new Error(r.data.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR));
      const user = r.data.body?.user;
      if (!user) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
      setMe(normalizeUser(user));
      dispatch(setUser(user));
      saveUser(user);
      setError(null);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR);
      setError({ text: msg });
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, [dispatch, t]);

  useEffect(() => {
    fetchMe().catch(() => {});
  }, [fetchMe]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const response = await axios.get<OrdersResponse>("/api/order/details");
      if (response.data.code !== "OK") throw new Error(response.data.message || "");
      setOrders(response.data.body?.orders ?? []);
    } catch {
      setOrdersError(t(I18N_KEYS.ACCOUNT_ORDERS_ERROR));
    } finally {
      setOrdersLoading(false);
      setOrdersLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    if (!router.isReady) return;
    const tabParam = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    if (isValidTab(tabParam)) setActiveTab(tabParam);
    if (router.query.openTopup !== undefined) {
      setActiveTab("transactions");
      setShowTopUpModal(true);
      const nextQuery = { ...router.query } as Record<string, any>;
      delete nextQuery.openTopup;
      router.replace({ pathname: "/account", query: nextQuery }, undefined, { shallow: true }).catch(() => {});
    }
  }, [router, router.isReady, router.query]);

  useEffect(() => {
    if ((activeTab === "orders" || activeTab === "transactions") && !ordersLoaded && !ordersLoading) {
      loadOrders().catch(() => {});
    }
  }, [activeTab, loadOrders, ordersLoaded, ordersLoading]);

  async function updateAccount(patch: AccountUpdatePayload) {
    const response = await axios.post<AccountUpdateResponse>("/api/v1/account/update", patch);
    if (response.data.code !== "OK") throw new Error(response.data.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_FAILED));
    const user = response.data.body?.user;
    if (!user) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
    setMe(normalizeUser(user));
    dispatch(setUser(user));
    saveUser(user);
  }

  // Email / Phone handlers (unchanged)
  async function handleVerifyEmail() {
    setError(null); setMessage(null);
    try {
      if (!auth.currentUser) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
      setVerifyingEmail(true);
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        await updateAccount({ is_email_verified: true });
        setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED });
        notify(t(I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED), "success");
      } else {
        const idToken = await auth.currentUser.getIdToken();
        const response = await axios.post("/api/user/send-verify-email", { idToken });
        if ((response.data as any).code !== "OK") throw new Error((response.data as any).message || t(I18N_KEYS.ACCOUNT_ERROR_VERIFY_EMAIL));
        setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT });
        notify(t(I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT), "info");
      }
    } catch (e: any) {
      const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_PROCESS_EMAIL);
      setError({ text: messageText });
      notify(messageText, "error");
    } finally {
      setVerifyingEmail(false);
    }
  }

  async function handleChangeEmail() {
    setError(null); setMessage(null);
    try {
      const trimmed = newEmail.trim();
      if (!trimmed) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NEW_EMAIL_REQUIRED));
      if (!auth.currentUser) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
      if (me?.is_email_verified && trimmed !== (me.email ?? null)) {
        const confirmMessage = t(I18N_KEYS.ACCOUNT_RESET_VERIFY_CONFIRM);
        if (!window.confirm(confirmMessage)) return;
      }
      setUpdatingEmail(true);
      await updateAccount({ email: trimmed });
      setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_UPDATED });
      notify(t(I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_UPDATED), "success");
      setNewEmail("");
    } catch (e: any) {
      const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_EMAIL);
      setError({ text: messageText });
      notify(messageText, "error");
    } finally {
      setUpdatingEmail(false);
    }
  }

  async function handleSendOtp() {
    setError(null); setMessage(null);
    try {
      const trimmed = phone.trim();
      if (!trimmed) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_PHONE_REQUIRED));
      if (me?.is_phone_verified && trimmed !== (me.phone ?? null)) {
        const confirmMessage = t(I18N_KEYS.ACCOUNT_RESET_VERIFY_CONFIRM);
        if (!window.confirm(confirmMessage)) return;
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
      const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_SEND_OTP);
      setError({ text: messageText });
      notify(messageText, "error");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleConfirmOtp() {
    setError(null); setMessage(null);
    try {
      const confirmation = confirmRef.current;
      if (!confirmation) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_OTP_SESSION));
      const code = otp.trim();
      if (!code) throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_ENTER_OTP));
      setConfirmingOtp(true);
      await confirmation.confirm(code);
      const trimmedPhone = phone.trim();
      await updateAccount({ phone: trimmedPhone || null, is_phone_verified: true });
      setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_PHONE_VERIFIED });
      notify(t(I18N_KEYS.ACCOUNT_MESSAGE_PHONE_VERIFIED), "success");
      setPhone(""); setOtp(""); confirmRef.current = null;
    } catch (e: any) {
      const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_CONFIRM_OTP);
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

  const handleTabChange = useCallback((tab: TabValue) => {
    setActiveTab(tab);
    if (!router.isReady) return;
    const nextQuery = { ...router.query } as Record<string, any>;
    if (tab === "details") delete nextQuery.tab;
    else nextQuery.tab = tab;
    delete nextQuery.openTopup;
    router.replace({ pathname: "/account", query: nextQuery }, undefined, { shallow: true }).catch(() => {});
  }, [router]);

  const handleRetryOrders = useCallback(() => {
    setOrdersLoaded(false);
    loadOrders().catch(() => {});
  }, [loadOrders]);

  const transactions = useMemo<TransactionItem[]>(() => {
    const map = new Map<number, TransactionItem>();
    orders.forEach((order) => {
      if (!order.txn) return;
      const existing = map.get(order.txn.id) ?? {
        id: order.txn.id,
        status: order.txn.status ?? null,
        expired_at: order.txn.expired_at ?? null,
        isExpired: !!order.txn.isExpired,
        latestCreatedAt: order.created_at ?? null,
        orders: [],
      };
      if (order.created_at) {
        const currentLatest = existing.latestCreatedAt ? new Date(existing.latestCreatedAt).getTime() : 0;
        const candidate = new Date(order.created_at).getTime();
        if (!Number.isNaN(candidate) && candidate > currentLatest) existing.latestCreatedAt = order.created_at;
      }
      existing.status = order.txn.status ?? existing.status;
      existing.expired_at = order.txn.expired_at ?? existing.expired_at;
      existing.isExpired = order.txn.isExpired ?? existing.isExpired;
      existing.orders.push({ id: order.id, status: order.displayStatus ?? order.status, created_at: order.created_at });
      map.set(order.txn.id, existing);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.latestCreatedAt ? new Date(a.latestCreatedAt).getTime() : 0;
      const bTime = b.latestCreatedAt ? new Date(b.latestCreatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [orders]);

  const safeUser = me ?? emptyUser;

  // --- UI RENDERERS ---------------------------------------------------------

  const OrderCard: React.FC<{ order: OrderDto }> = ({ order }) => {
    const [open, setOpen] = useState(false);

    const txn = order.txn;
    const isPendingTxn = txn && txn.status === "pending" && !txn.isExpired;
    const showExpired = txn && (txn.isExpired || (!!txn.expired_at && new Date(txn.expired_at).getTime() <= Date.now()));

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {t(I18N_KEYS.ACCOUNT_ORDER_NUMBER_PREFIX)} {order.id}
            </p>
            <p className="text-xs text-slate-500">{formatBangkok(order.created_at, loc)}</p>
            {order.branch && (
              <p className="mt-2 text-sm text-slate-600">
                {order.branch.name}
                {order.branch.address ? ` • ${order.branch.address}` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700">
              {humanOrderStatus(order.displayStatus || order.status, loc)}
            </span>

            {/* Pay now / Retry upload for pending txns */}
            {txn && isPendingTxn && (
              <Link
                href={`/payment/${txn.id}?orderId=${order.id}`}
                className="inline-flex h-8 items-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                {t(I18N_KEYS.ACCOUNT_RETRY_UPLOAD_SLIP)}
              </Link>
            )}

            {txn && showExpired && (
              <span className="inline-flex h-8 items-center rounded-xl bg-rose-600/10 px-3 text-xs font-semibold text-rose-700">
                {t(I18N_KEYS.ORDER_STATUS_EXPIRED)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setOpen((s) => !s)}
              className="inline-flex h-8 items-center rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              aria-expanded={open}
            >
              {open ? t(I18N_KEYS.COMMON_HIDE_DETAILS) : t(I18N_KEYS.COMMON_VIEW_DETAILS)}
            </button>
          </div>
        </div>

        {/* Transaction panel */}
        {txn && (
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t(I18N_KEYS.ACCOUNT_TRANSACTION_NUMBER_PREFIX)} {txn.id}
              </span>
              <span className="font-medium">
                {humanTxnStatus(txn.status, loc, Boolean(txn.isExpired))}
              </span>
            </div>
            {txn.expired_at && (
              <p className="mt-2 text-[11px] text-slate-500">
                {t(I18N_KEYS.ACCOUNT_TRANSACTION_EXPIRES_AT)}: {formatBangkok(txn.expired_at, loc)}
              </p>
            )}
          </div>
        )}

        {/* Collapsible details */}
        {open && (
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{t(I18N_KEYS.ACCOUNT_ORDER_ITEMS)}</h4>
              <div className="mt-2 divide-y rounded-2xl border border-slate-200">
                {order.order_details.productList.map((p, idx) => (
                  <div key={`${p.productId}-${idx}`} className="p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">{p.productName}</span>
                      <span className="text-slate-700">x{p.qty}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t(I18N_KEYS.CHECKOUT_PRICE)}: {p.price}
                    </div>
                    {!!p.productAddOns?.length && (
                      <div className="mt-1 text-xs text-slate-500">
                        {t(I18N_KEYS.CHECKOUT_ADDONS)}:{" "}
                        {p.productAddOns.map((a) => `${a.name} (+${a.price})`).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {order.order_details?.delivery && (
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{t(I18N_KEYS.ACCOUNT_DELIVERY)}</h4>
                <p className="mt-1 text-xs text-slate-600">
                  {t(I18N_KEYS.ACCOUNT_DISTANCE)}: {order.order_details.delivery.distanceKm ?? "-"} km
                </p>
                {order.order_details.delivery.lat && order.order_details.delivery.lng && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    href={`https://www.openstreetmap.org/?mlat=${order.order_details.delivery.lat}&mlon=${order.order_details.delivery.lng}#map=16/${order.order_details.delivery.lat}/${order.order_details.delivery.lng}`}
                  >
                    {t(I18N_KEYS.ACCOUNT_VIEW_ON_MAP)}
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrders = () => {
    if (ordersLoading && !ordersLoaded) return <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>;
    if (ordersError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div>{ordersError}</div>
          <button
            type="button"
            onClick={handleRetryOrders}
            className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            {t(I18N_KEYS.COMMON_RETRY)}
          </button>
        </div>
      );
    }
    if (!orders.length) return <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_ORDERS_EMPTY)}</p>;
    return <div className="space-y-4">{orders.map((o) => <OrderCard key={o.id} order={o} />)}</div>;
  };

  const renderTransactions = () => {
    if (ordersLoading && !ordersLoaded) return <p className="text-sm text-slate-500">{t(I18N_KEYS.COMMON_LOADING)}</p>;
    if (ordersError) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div>{ordersError}</div>
          <button
            type="button"
            onClick={handleRetryOrders}
            className="mt-3 inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            {t(I18N_KEYS.COMMON_RETRY)}
          </button>
        </div>
      );
    }
    if (!transactions.length) return <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_TRANSACTIONS_EMPTY)}</p>;
    return (
      <div className="space-y-4">
        {transactions.map((txn) => (
          <div key={txn.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {t(I18N_KEYS.ACCOUNT_TRANSACTION_NUMBER_PREFIX)} {txn.id}
                </p>
                <p className="text-xs text-slate-500">{formatBangkok(txn.latestCreatedAt, loc)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 items-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700">
                  {humanTxnStatus(txn.status, loc, txn.isExpired)}
                </span>
                {txn.status === "pending" && !txn.isExpired && (
                  <Link
                    href={`/payment/${txn.id}`}
                    className="inline-flex h-7 items-center rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    {t(I18N_KEYS.ACCOUNT_RETRY_UPLOAD_SLIP)}
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {txn.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-1 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    {t(I18N_KEYS.ACCOUNT_ORDER_NUMBER_PREFIX)} {order.id}
                  </span>
                  <span className="font-medium text-slate-700">
                    {humanOrderStatus(order.status, loc)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 pb-10 pt-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t(I18N_KEYS.ACCOUNT_TITLE)}</h1>
          <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_SUBTITLE)}</p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-2xl bg-slate-100 p-1">
            {([
              { key: "details", label: I18N_KEYS.ACCOUNT_TAB_DETAILS },
              { key: "orders", label: I18N_KEYS.ACCOUNT_TAB_ORDERS },
              { key: "transactions", label: I18N_KEYS.ACCOUNT_TAB_TRANSACTIONS },
            ] as Array<{ key: TabValue; label: I18nKey }>).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`inline-flex min-w-[110px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none ${
                    isActive ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:bg-white/70"
                  }`}
                  aria-pressed={isActive}
                >
                  {t(tab.label)}
                </button>
              );
            })}
          </div>

          {activeTab === "transactions" && (
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              {t(I18N_KEYS.NAV_ACCOUNT_TOP_UP)}
            </button>
          )}
        </div>

        {activeTab === "details" && (
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
        )}

        {activeTab === "orders" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{renderOrders()}</div>
        )}

        {activeTab === "transactions" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{renderTransactions()}</div>
        )}
      </div>

      {/* Top up modal (unchanged content, kept simple) */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t(I18N_KEYS.ACCOUNT_TOPUP_TITLE)}</h2>
                <p className="mt-1 text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_TOPUP_DESCRIPTION)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                aria-label={t(I18N_KEYS.ACCOUNT_TOPUP_CLOSE)}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">{t(I18N_KEYS.ACCOUNT_TOPUP_QR)}</h3>
                <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.ACCOUNT_TOPUP_QR_HINT)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-800">{t(I18N_KEYS.ACCOUNT_TOPUP_BALANCE)}</h3>
                <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.ACCOUNT_TOPUP_BALANCE_HINT)}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTopUpModal(false)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                {t(I18N_KEYS.ACCOUNT_TOPUP_CLOSE)}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

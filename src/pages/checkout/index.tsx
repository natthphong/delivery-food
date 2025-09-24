import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";
import Layout from "@components/Layout";
import MethodPicker from "@/components/payment/MethodPicker";
import type { TransactionMethod, TransactionRow } from "@/types/transaction";
import type { CartBranchGroup, UserRecord } from "@/types";
import axios, { type ApiResponse } from "@/utils/apiClient";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { RootState, useAppDispatch } from "@/store";
import { notify } from "@/utils/notify";
import { setUser } from "@/store/authSlice";
import { appendIdWithTrim } from "@/utils/history";
import { buildCartItemKey } from "@/utils/cart";
import { saveUser } from "@/utils/tokenStorage";
import type { MapConfirmValue } from "@/components/checkout/MapConfirm";
import { logError } from "@/utils/logger";

const MapConfirm = dynamic(() => import("@/components/checkout/MapConfirm"), { ssr: false });

const CHECKOUT_DRAFT_KEY = "CHECKOUT_DRAFT";
const TXN_HISTORY_LIMIT = 50;
const ORDER_HISTORY_LIMIT = 100;

type PaymentResponseBody = {
    method: TransactionMethod | null;
    txn: TransactionRow | null;
    order: { id: number } | null;
    paymentPayload?: { payment_id: string } | null;
    balance?: number;
};

type PaymentResponse = ApiResponse<PaymentResponseBody>;

function computeTotal(branches: CartBranchGroup[]): number {
    return branches.reduce((branchAcc, branch) => {
        const branchTotal = branch.productList.reduce((itemAcc, item) => {
            const addOnTotal = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
            return itemAcc + (item.price + addOnTotal) * item.qty;
        }, 0);
        return branchAcc + branchTotal;
    }, 0);
}

export default function CheckoutPage() {
    const { t } = useI18n();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const user = useSelector((state: RootState) => state.auth.user);
    const [draft, setDraft] = useState<CartBranchGroup[]>([]);
    const [methods, setMethods] = useState<TransactionMethod[]>([]);
    const [methodsLoading, setMethodsLoading] = useState(false);
    const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [branchLocation, setBranchLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [branchLocationLoading, setBranchLocationLoading] = useState(false);
    const [locationValue, setLocationValue] = useState<MapConfirmValue | null>(null);
    const [locationConfirmed, setLocationConfirmed] = useState(false);
    const previousLocationRef = useRef<MapConfirmValue | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
        if (!raw) {
            setDraft([]);
            return;
        }
        try {
            const parsed = JSON.parse(raw) as CartBranchGroup[];
            setDraft(Array.isArray(parsed) ? parsed : []);
        } catch {
            setDraft([]);
        }
    }, []);

    const firstGroup = draft[0];
    const companyId = useMemo(() => {
        if (!firstGroup?.companyId) return null;
        const num = Number(firstGroup.companyId);
        return Number.isFinite(num) ? num : null;
    }, [firstGroup]);

    const branchIdNumeric = useMemo(() => {
        if (!firstGroup?.branchId) return null;
        const num = Number(firstGroup.branchId);
        return Number.isFinite(num) ? num : null;
    }, [firstGroup]);

    useEffect(() => {
        if (!companyId || !user) {
            setMethods([]);
            return;
        }
        setMethodsLoading(true);
        axios
            .get<ApiResponse<{ methods: TransactionMethod[] }>>("/api/transaction/method", {
                params: { companyId },
            })
            .then((response) => {
                if (response.data.code === "OK" && Array.isArray(response.data.body?.methods)) {
                    setMethods(response.data.body.methods);
                    if (!selectedMethodId && response.data.body.methods.length > 0) {
                        setSelectedMethodId(response.data.body.methods[0].id);
                    }
                } else {
                    setMethods([]);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.PAYMENT_METHOD_ERROR), "error");
                setMethods([]);
            })
            .finally(() => {
                setMethodsLoading(false);
            });
    }, [companyId, user, t]);

    useEffect(() => {
        if (!branchIdNumeric) {
            setBranchLocation(null);
            return;
        }
        setBranchLocationLoading(true);
        axios
            .get<ApiResponse<{ branch: { lat: number | null; lng: number | null } | null }>>(
                `/api/branches/${branchIdNumeric}/menu`,
                {
                    params: { page: 1, size: 1 },
                }
            )
            .then((response) => {
                const branch = (response.data.body as any)?.branch;
                if (branch && Number.isFinite(branch.lat) && Number.isFinite(branch.lng)) {
                    setBranchLocation({ lat: Number(branch.lat), lng: Number(branch.lng) });
                } else {
                    setBranchLocation(null);
                }
            })
            .catch((error) => {
                notify(error?.response?.data?.message || t(I18N_KEYS.CHECKOUT_LOCATION_BRANCH_ERROR), "error");
                setBranchLocation(null);
            })
            .finally(() => {
                setBranchLocationLoading(false);
            });
    }, [branchIdNumeric, t]);

    useEffect(() => {
        setLocationValue(null);
        setLocationConfirmed(false);
        previousLocationRef.current = null;
    }, [branchIdNumeric]);

    const totalAmount = useMemo(() => computeTotal(draft), [draft]);

    const handleLocationChange = useCallback(
        (next: MapConfirmValue) => {
            const prev = previousLocationRef.current;
            const hasChanged =
                !prev || prev.lat !== next.lat || prev.lng !== next.lng || prev.distanceKm !== next.distanceKm;
            previousLocationRef.current = next;
            setLocationValue(next);
            if (hasChanged) {
                setLocationConfirmed(false);
            }
        },
        []
    );

    const handleClearDraft = () => {
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
        }
        setDraft([]);
        setLocationValue(null);
        setLocationConfirmed(false);
        previousLocationRef.current = null;
    };

    const handleSubmit = async () => {
        if (!user || !firstGroup || !companyId) {
            notify(t(I18N_KEYS.PAYMENT_SUBMIT_ERROR), "error");
            return;
        }
        if (!selectedMethodId) {
            notify(t(I18N_KEYS.PAYMENT_METHOD_REQUIRED), "warning");
            return;
        }
        if (totalAmount <= 0) {
            notify(t(I18N_KEYS.PAYMENT_AMOUNT_INVALID), "warning");
            return;
        }

        if (!locationValue || !locationConfirmed) {
            notify(t(I18N_KEYS.CHECKOUT_LOCATION_CONFIRM_REQUIRED), "warning");
            return;
        }

        const orderDetails = {
            userId: user.id,
            branchId: firstGroup.branchId,
            branchName: firstGroup.branchName,
            productList: firstGroup.productList.map((item) => ({
                qty: item.qty,
                price: item.price,
                productId: item.productId,
                productName: item.productName,
                productAddOns: item.productAddOns.map((addon) => ({ name: addon.name, price: addon.price })),
            })),
            delivery: {
                lat: locationValue.lat,
                lng: locationValue.lng,
                distanceKm: locationValue.distanceKm,
            },
        };

        const payload = {
            companyId,
            methodId: selectedMethodId,
            amount: totalAmount,
            branchId: Number(firstGroup.branchId),
            orderDetails,
        };

        try {
            setSubmitting(true);
            const response = await axios.post<PaymentResponse>("/api/payment", payload);
            if (response.data.code !== "OK" || !response.data.body?.txn || !response.data.body?.order) {
                throw new Error(response.data.message || "PAYMENT_FAILED");
            }

            const method = response.data.body.method;
            const txn = response.data.body.txn;
            const order = response.data.body.order;

            const applyFallbackUser = () => {
                if (!user) return;
                const purchasedKeys = new Set<string>();
                firstGroup.productList.forEach((item) => {
                    purchasedKeys.add(buildCartItemKey(firstGroup.branchId, item));
                });
                const updatedCard = (user.card ?? [])
                    .map((group) => {
                        if (group.branchId !== firstGroup.branchId) return group;
                        const filtered = group.productList.filter(
                            (item) => !purchasedKeys.has(buildCartItemKey(group.branchId, item))
                        );
                        return { ...group, productList: filtered };
                    })
                    .filter((group) => group.productList.length > 0);
                const fallbackUser: UserRecord = {
                    ...user,
                    card: updatedCard,
                    balance: response.data.body.balance ?? user.balance,
                    txn_history: appendIdWithTrim(user.txn_history, txn.id, TXN_HISTORY_LIMIT),
                    order_history: appendIdWithTrim(user.order_history, order.id, ORDER_HISTORY_LIMIT),
                };
                dispatch(setUser(fallbackUser));
                saveUser(fallbackUser);
            };

            try {
                const clearResponse = await axios.post<ApiResponse<{ user: UserRecord }>>(
                    "/api/card/clear-by-branch",
                    { branchId: Number(firstGroup.branchId) }
                );
                if (clearResponse.data.code === "OK" && clearResponse.data.body?.user) {
                    dispatch(setUser(clearResponse.data.body.user));
                    saveUser(clearResponse.data.body.user);
                } else {
                    applyFallbackUser();
                }
            } catch (error: any) {
                logError("checkout clear card error", { message: error?.message });
                applyFallbackUser();
            }

            handleClearDraft();

            if (method?.type === "balance") {
                notify(t(I18N_KEYS.PAYMENT_BALANCE_SUCCESS), "success");
                void router.push({ pathname: "/account", query: { tab: "orders" } });
                return;
            }

            notify(t(I18N_KEYS.PAYMENT_QR_CREATED), "info");
            void router.push(`/payment/${txn.id}`);
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || t(I18N_KEYS.PAYMENT_SUBMIT_ERROR);
            notify(message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const hasDraft = draft.length > 0;

    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold text-slate-900">{t(I18N_KEYS.CHECKOUT_TITLE)}</h1>
                    <p className="text-sm text-slate-500">{t(I18N_KEYS.CHECKOUT_SUBTITLE)}</p>
                </header>

                {!hasDraft ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.CHECKOUT_EMPTY_TITLE)}</p>
                        <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_EMPTY_SUBTITLE)}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-900">{firstGroup.branchName}</h2>
                            <ul className="mt-4 space-y-4">
                                {firstGroup.productList.map((item) => {
                                    const addOnTotal = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
                                    const total = (item.price + addOnTotal) * item.qty;
                                    return (
                                        <li key={buildCartItemKey(firstGroup.branchId, item)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{item.productName}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {t(I18N_KEYS.CHECKOUT_ITEM_QTY, { qty: item.qty })}
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
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right text-sm font-semibold text-emerald-700">
                                {t(I18N_KEYS.CHECKOUT_TOTAL_PREFIX)} {formatTHB(totalAmount)}
                            </div>
                        </div>

                        <section className="space-y-4">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.PAYMENT_METHOD_TITLE)}</h2>
                                <p className="text-xs text-slate-500">{t(I18N_KEYS.PAYMENT_METHOD_SUBTITLE)}</p>
                            </div>
                            <MethodPicker
                                methods={methods}
                                loading={methodsLoading}
                                selectedId={selectedMethodId}
                                onSelect={setSelectedMethodId}
                            />
                        </section>

                        <MapConfirm
                            branchLocation={branchLocation}
                            loading={branchLocationLoading}
                            value={locationValue}
                            onChange={handleLocationChange}
                            confirmed={locationConfirmed}
                            onConfirmChange={setLocationConfirmed}
                        />

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                            <button
                                type="button"
                                onClick={handleClearDraft}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                                {t(I18N_KEYS.CHECKOUT_CLEAR_DRAFT)}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={
                                    submitting ||
                                    !selectedMethodId ||
                                    !locationValue ||
                                    !locationConfirmed
                                }
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_SUBMIT_BUTTON)}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

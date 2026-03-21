import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import dynamic from "next/dynamic";
import Layout from "@components/Layout";
import MethodPicker from "@/components/payment/MethodPicker";
import type { TransactionMethod } from "@/types/transaction";
import type { CartBranchGroup } from "@/types";
import { formatTHB } from "@/utils/currency";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { RootState, useAppDispatch } from "@/store";
import { notify } from "@/utils/notify";
import { setCart } from "@/store/cartSlice";
import { setUser } from "@/store/authSlice";
import type { MapConfirmValue } from "@/components/checkout/MapConfirm";
import { CHECKOUT_DRAFT_KEY } from "@/components/cart/CartDrawer";
import { fetchBranchMenu, fetchPaymentMethods } from "@/services/catalog";
import { checkout } from "@/services/payment";

const MapConfirm = dynamic(() => import("@/components/checkout/MapConfirm"), { ssr: false });

type CheckoutDraft = {
    branchId: number;
    itemIds: number[];
};

function parseDraft(): CheckoutDraft | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CheckoutDraft;
    } catch {
        return null;
    }
}

export default function CheckoutPage() {
    const { t } = useI18n();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const user = useSelector((state: RootState) => state.auth.user);
    const cart = useSelector((state: RootState) => state.cart.value);
    const [draft, setDraft] = useState<CheckoutDraft | null>(null);
    const [methods, setMethods] = useState<TransactionMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [locationValue, setLocationValue] = useState<MapConfirmValue | null>(null);
    const [locationConfirmed, setLocationConfirmed] = useState(false);
    const [branchCoords, setBranchCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [loadingBranch, setLoadingBranch] = useState(false);
    const previousLocationRef = useRef<MapConfirmValue | null>(null);

    useEffect(() => {
        setDraft(parseDraft());
    }, []);

    const selectedGroup = useMemo<CartBranchGroup | null>(() => {
        if (!draft) return null;
        const group = cart.groups.find((item) => item.branchId === draft.branchId);
        if (!group) return null;
        const items = group.items.filter((item) => draft.itemIds.includes(item.id));
        if (items.length === 0) return null;
        return {
            ...group,
            items,
            subTotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
        };
    }, [cart.groups, draft]);

    useEffect(() => {
        if (!selectedGroup?.companyId) {
            setMethods([]);
            return;
        }
        fetchPaymentMethods(selectedGroup.companyId)
            .then((items) => {
                setMethods(items);
                setSelectedMethodId(items[0]?.id ?? null);
            })
            .catch((error: any) => {
                notify(error?.message || t(I18N_KEYS.PAYMENT_METHOD_ERROR), "error");
                setMethods([]);
            });
    }, [selectedGroup?.companyId, t]);

    useEffect(() => {
        if (!selectedGroup?.branchId) {
            setBranchCoords(null);
            return;
        }
        setLoadingBranch(true);
        fetchBranchMenu(selectedGroup.branchId, { page: 1, size: 1 })
            .then((payload) => {
                if (payload.branch.lat != null && payload.branch.lng != null) {
                    setBranchCoords({ lat: payload.branch.lat, lng: payload.branch.lng });
                } else {
                    setBranchCoords(null);
                }
            })
            .catch(() => {
                setBranchCoords(null);
            })
            .finally(() => {
                setLoadingBranch(false);
            });
    }, [selectedGroup?.branchId]);

    const totalAmount = useMemo(
        () => selectedGroup?.items.reduce((sum, item) => sum + item.lineTotal, 0) ?? 0,
        [selectedGroup]
    );

    const handleLocationChange = (next: MapConfirmValue) => {
        const prev = previousLocationRef.current;
        const changed = !prev || prev.lat !== next.lat || prev.lng !== next.lng || prev.distanceKm !== next.distanceKm;
        previousLocationRef.current = next;
        setLocationValue(next);
        if (changed) setLocationConfirmed(false);
    };

    const handleSubmit = async () => {
        if (!user || !draft || !selectedGroup || !selectedMethodId) {
            notify(t(I18N_KEYS.PAYMENT_SUBMIT_ERROR), "error");
            return;
        }
        if (!locationValue || !locationConfirmed) {
            notify(t(I18N_KEYS.CHECKOUT_LOCATION_CONFIRM_REQUIRED), "warning");
            return;
        }
        try {
            setSubmitting(true);
            const result = await checkout({
                branchId: selectedGroup.branchId,
                paymentMethodId: selectedMethodId,
                selectedItemIds: selectedGroup.items.map((item) => item.id),
                deliveryLat: locationValue.lat,
                deliveryLng: locationValue.lng,
                deliveryDistanceKm: locationValue.distanceKm ?? 0,
            });
            dispatch(setCart(result.cart));
            if (result.user) {
                dispatch(setUser(result.user));
            }
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
            }
            if (result.method.methodType === "balance") {
                notify(t(I18N_KEYS.PAYMENT_BALANCE_SUCCESS), "success");
                void router.push("/account?tab=orders");
                return;
            }
            notify(t(I18N_KEYS.PAYMENT_QR_CREATED), "success");
            void router.push(`/payment/${result.transaction.id}`);
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.PAYMENT_SUBMIT_ERROR), "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout>
            <div className="mx-auto max-w-4xl space-y-6">
                <header className="rounded-[2rem] bg-[linear-gradient(135deg,#064e3b_0%,#10b981_55%,#d1fae5_130%)] px-6 py-7 text-white shadow-xl">
                    <h1 className="text-2xl font-semibold sm:text-3xl">{t(I18N_KEYS.CHECKOUT_TITLE)}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-emerald-50">{t(I18N_KEYS.CHECKOUT_SUBTITLE)}</p>
                </header>

                {!selectedGroup ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                        <p className="text-sm font-medium text-slate-700">{t(I18N_KEYS.CHECKOUT_EMPTY_TITLE)}</p>
                        <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_EMPTY_SUBTITLE)}</p>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-6">
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">{selectedGroup.branchName}</h2>
                                        <p className="text-sm text-slate-500">{selectedGroup.items.length} selected dishes</p>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                        {formatTHB(totalAmount)}
                                    </span>
                                </div>
                                <ul className="mt-4 space-y-3">
                                    {selectedGroup.items.map((item) => (
                                        <li key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                                            {item.imageUrl ? (
                                                <img src={item.imageUrl} alt={item.productName} className="h-20 w-20 rounded-2xl object-cover" />
                                            ) : (
                                                <div className="h-20 w-20 rounded-2xl bg-slate-100" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                                        {item.addOns.length > 0 ? (
                                                            <p className="mt-1 text-xs text-slate-500">{item.addOns.map((addOn) => addOn.name).join(", ")}</p>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-sm font-semibold text-emerald-600">{formatTHB(item.lineTotal)}</p>
                                                </div>
                                                <p className="mt-2 text-xs text-slate-500">Qty {item.quantity}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <MethodPicker
                                    methods={methods}
                                    selectedId={selectedMethodId}
                                    onSelect={setSelectedMethodId}
                                    loading={false}
                                    title={t(I18N_KEYS.PAYMENT_METHOD_TITLE)}
                                    subtitle={t(I18N_KEYS.PAYMENT_METHOD_SUBTITLE)}
                                />
                            </section>

                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h2 className="text-base font-semibold text-slate-900">{t(I18N_KEYS.CHECKOUT_LOCATION_TITLE)}</h2>
                                <p className="mt-1 text-sm text-slate-500">{t(I18N_KEYS.CHECKOUT_LOCATION_SUBTITLE)}</p>
                                <div className="mt-4">
                                    <MapConfirm
                                        branchLocation={branchCoords}
                                        loading={loadingBranch}
                                        value={locationValue}
                                        onChange={handleLocationChange}
                                        confirmed={locationConfirmed}
                                        onConfirmChange={setLocationConfirmed}
                                    />
                                </div>
                            </section>
                        </div>

                        <aside className="lg:sticky lg:top-24 lg:self-start">
                            <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl">
                                <p className="text-sm text-slate-300">Order summary</p>
                                <div className="mt-4 space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-300">Items</span>
                                        <span>{selectedGroup.items.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-300">Subtotal</span>
                                        <span>{formatTHB(totalAmount)}</span>
                                    </div>
                                    {locationValue?.distanceKm ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-300">Delivery distance</span>
                                            <span>{locationValue.distanceKm.toFixed(2)} km</span>
                                        </div>
                                    ) : null}
                                </div>
                                <div className="mt-5 border-t border-white/10 pt-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-300">Pay now</span>
                                        <span className="text-2xl font-semibold">{formatTHB(totalAmount)}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleSubmit()}
                                        disabled={submitting || !selectedMethodId}
                                        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {submitting ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_SUBMIT_BUTTON)}
                                    </button>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </Layout>
    );
}

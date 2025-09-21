import { useEffect, useMemo, useState } from "react";
import Layout from "@components/Layout";
import type { CartBranchGroup } from "@/types";
import { formatTHB } from "@utils/currency";
import Link from "next/link";

const CHECKOUT_DRAFT_KEY = "CHECKOUT_DRAFT";

export default function CheckoutPage() {
    const [draft, setDraft] = useState<CartBranchGroup[]>([]);

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

    const total = useMemo(() => {
        return draft.reduce((branchAcc, branch) => {
            const branchTotal = branch.productList.reduce((itemAcc, item) => {
                const addOns = item.productAddOns.reduce((sum, addon) => sum + addon.price, 0);
                return itemAcc + (item.price + addOns) * item.qty;
            }, 0);
            return branchAcc + branchTotal;
        }, 0);
    }, [draft]);

    return (
        <Layout>
            <div className="mx-auto max-w-3xl space-y-6">
                <header className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold text-slate-900">Checkout</h1>
                    <p className="text-sm text-slate-500">Review your selected dishes before placing the order.</p>
                </header>

                {draft.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <p className="text-sm font-medium text-slate-700">No items selected for checkout.</p>
                        <p className="mt-2 text-xs text-slate-500">
                            Return to the menu and add items to your basket first.
                        </p>
                        <Link
                            href="/"
                            className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                        >
                            Back to home
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {draft.map((branch) => (
                            <div key={branch.branchId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <h2 className="text-sm font-semibold text-slate-900">{branch.branchName}</h2>
                                <ul className="mt-3 space-y-3">
                                    {branch.productList.map((item) => {
                                        const addOns = item.productAddOns.reduce(
                                            (sum, addon) => sum + addon.price,
                                            0
                                        );
                                        const totalPrice = (item.price + addOns) * item.qty;
                                        return (
                                            <li key={`${item.productId}-${item.qty}-${totalPrice}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                                                        {item.productAddOns.length > 0 && (
                                                            <p className="text-xs text-slate-500">
                                                                {item.productAddOns
                                                                    .map((addon) => `+ ${addon.name} ${formatTHB(addon.price)}`)
                                                                    .join(", ")}
                                                            </p>
                                                        )}
                                                        <p className="mt-1 text-xs text-slate-500">Qty: {item.qty}</p>
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-900">{formatTHB(totalPrice)}</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right text-sm font-semibold text-emerald-700">
                            Total {formatTHB(total)}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                onClick={() => {
                                    if (typeof window !== "undefined") {
                                        window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
                                    }
                                    setDraft([]);
                                }}
                            >
                                Clear draft
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                            >
                                Place order (coming soon)
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}

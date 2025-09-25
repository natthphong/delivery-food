import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Modal from "@/components/common/Modal";
import axios, { type ApiResponse } from "@/utils/apiClient";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { notify } from "@/utils/notify";
import type { TransactionMethod, TransactionRow } from "@/types/transaction";
import { humanMethodType } from "@/constants/statusMaps";

type DepositModalProps = {
    open: boolean;
    onClose: () => void;
    defaultBranchId: number;
    defaultCompanyId: number;
};

type MethodResponse = ApiResponse<{ methods: TransactionMethod[] }>;
type CreateResponse = ApiResponse<{ txn: TransactionRow | null }>;

function parsePositiveAmount(value: string): number | null {
    if (!value.trim()) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
        return null;
    }
    return Math.round(num * 100) / 100;
}

export default function DepositModal({ open, onClose, defaultBranchId, defaultCompanyId }: DepositModalProps) {
    const router = useRouter();
    const { t, locale } = useI18n();
    const [amount, setAmount] = useState("");
    const [methods, setMethods] = useState<TransactionMethod[]>([]);
    const [loadingMethods, setLoadingMethods] = useState(false);
    const [methodsError, setMethodsError] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        setAmount("");
        setSelectedMethod(null);
        setMethods([]);
        setMethodsError(null);

        if (!defaultCompanyId) {
            setMethodsError(t(I18N_KEYS.DEPOSIT_METHOD_ERROR));
            return;
        }

        setLoadingMethods(true);
        axios
            .get<MethodResponse>("/api/transaction/method", { params: { companyId: defaultCompanyId } })
            .then((response) => {
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || "method_error");
                }
                const list = Array.isArray(response.data.body?.methods) ? response.data.body.methods : [];
                const qrMethods = list.filter((item) => item.type === "qr");
                setMethods(qrMethods);
                if (qrMethods.length === 0) {
                    setMethodsError(t(I18N_KEYS.DEPOSIT_METHOD_EMPTY));
                } else {
                    setSelectedMethod(qrMethods[0].id);
                }
            })
            .catch((error) => {
                const message = error?.response?.data?.message || t(I18N_KEYS.DEPOSIT_METHOD_ERROR);
                setMethodsError(message);
                setMethods([]);
            })
            .finally(() => {
                setLoadingMethods(false);
            });
    }, [defaultCompanyId, open, t]);

    const footer = useMemo(
        () => (
            <>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    disabled={submitting}
                >
                    {t(I18N_KEYS.COMMON_CANCEL)}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const normalized = parsePositiveAmount(amount);
                        if (normalized == null) {
                            notify(t(I18N_KEYS.DEPOSIT_AMOUNT_INVALID), "warning");
                            return;
                        }
                        if (!selectedMethod) {
                            notify(t(I18N_KEYS.PAYMENT_METHOD_REQUIRED), "warning");
                            return;
                        }
                        setSubmitting(true);
                        axios
                            .post<CreateResponse>("/api/transaction/create", {
                                companyId: defaultCompanyId,
                                txnType: "deposit",
                                methodId: selectedMethod,
                                amount: normalized,
                            })
                            .then((response) => {
                                if (response.data.code !== "OK" || !response.data.body?.txn) {
                                    throw new Error(response.data.message || "create_error");
                                }
                                const txn = response.data.body.txn;
                                onClose();
                                router.push({
                                    pathname: `/payment/${txn.id}`,
                                    query: {
                                        mode: "deposit",
                                        amount: normalized.toFixed(2),
                                        branchId: defaultBranchId,
                                    },
                                });
                            })
                            .catch((error) => {
                                const message = error?.response?.data?.message || t(I18N_KEYS.PAYMENT_SUBMIT_ERROR);
                                notify(message, "error");
                            })
                            .finally(() => {
                                setSubmitting(false);
                            });
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting || loadingMethods || !defaultCompanyId}
                >
                    {submitting ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.DEPOSIT_CONTINUE)}
                </button>
            </>
        ),
        [amount, defaultBranchId, defaultCompanyId, loadingMethods, onClose, router, selectedMethod, submitting, t]
    );

    return (
        <Modal open={open} onClose={onClose} title={t(I18N_KEYS.DEPOSIT_TITLE)} footer={footer} size="sm">
            <div className="space-y-4">
                <p className="text-sm text-slate-500">{t(I18N_KEYS.DEPOSIT_SUBTITLE)}</p>

                <div className="space-y-2">
                    <label htmlFor="deposit-amount" className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t(I18N_KEYS.DEPOSIT_AMOUNT_LABEL)}
                    </label>
                    <input
                        id="deposit-amount"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        placeholder={t(I18N_KEYS.DEPOSIT_AMOUNT_PLACEHOLDER)}
                    />
                </div>

                <div className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t(I18N_KEYS.DEPOSIT_METHOD_LABEL)}
                    </span>
                    {loadingMethods ? (
                        <p className="text-sm text-slate-500">{t(I18N_KEYS.DEPOSIT_METHOD_LOADING)}</p>
                    ) : methods.length > 0 ? (
                        <ul className="space-y-2">
                            {methods.map((method) => {
                                const checked = selectedMethod === method.id;
                                const label = humanMethodType(method.type as any, locale);
                                return (
                                    <li key={method.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMethod(method.id)}
                                            className={`w-full rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                                                checked
                                                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            }`}
                                            aria-pressed={checked}
                                        >
                                            <p className="text-sm font-semibold">{method.name}</p>
                                            <p className="text-xs text-slate-500">{label}</p>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="text-sm text-slate-500">{methodsError ?? t(I18N_KEYS.DEPOSIT_METHOD_EMPTY)}</p>
                    )}
                </div>

                {methodsError && methods.length === 0 && !loadingMethods ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{methodsError}</p>
                ) : null}
            </div>
        </Modal>
    );
}

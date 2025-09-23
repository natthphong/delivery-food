import type { TransactionMethod } from "@/types/transaction";
import { I18N_KEYS } from "@/constants/i18nKeys";
import type { I18nKey } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";

type MethodPickerProps = {
    methods: TransactionMethod[];
    selectedId: number | null;
    onSelect: (methodId: number) => void;
    loading?: boolean;
};

const METHOD_I18N: Record<string, I18nKey> = {
    qr: I18N_KEYS.PAYMENT_METHOD_QR,
    balance: I18N_KEYS.PAYMENT_METHOD_BALANCE,
};

export function MethodPicker({ methods, selectedId, onSelect, loading }: MethodPickerProps) {
    const { t } = useI18n();

    if (loading) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_METHOD_LOADING)}</p>
            </div>
        );
    }

    if (methods.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">{t(I18N_KEYS.PAYMENT_METHOD_EMPTY)}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {methods.map((method) => {
                const isActive = selectedId === method.id;
                const typeKey = METHOD_I18N[method.type];
                const typeLabel = typeKey ? t(typeKey) : method.type;
                return (
                    <button
                        key={method.id}
                        type="button"
                        onClick={() => onSelect(method.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            isActive
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-emerald-200"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{method.name}</p>
                                <p className="text-xs text-slate-500">{typeLabel}</p>
                            </div>
                            <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                                    isActive ? "border-emerald-500" : "border-slate-300"
                                }`}
                                aria-hidden="true"
                            >
                                {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

export default MethodPicker;

import { useState } from "react";
import axios, { type ApiResponse } from "@/utils/apiClient";
import type { TransactionRow } from "@/types/transaction";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { notify } from "@/utils/notify";

type SlipUploadProps = {
    txnId: number;
    onSuccess: (txn: TransactionRow) => void;
};

export function SlipUpload({ txnId, onSuccess }: SlipUploadProps) {
    const { t } = useI18n();
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!file) {
            notify(t(I18N_KEYS.PAYMENT_SLIP_REQUIRED), "warning");
            return;
        }
        const formData = new FormData();
        formData.append("txnId", String(txnId));
        formData.append("qrFile", file);

        try {
            setSubmitting(true);
            const response = await axios.post<ApiResponse<{ txn: TransactionRow }>>("/api/payment/slipok", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (response.data.code !== "OK" || !response.data.body?.txn) {
                throw new Error(response.data.message || "INVALID_RESPONSE");
            }
            notify(t(I18N_KEYS.PAYMENT_SLIP_SUCCESS), "success");
            onSuccess(response.data.body.txn);
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || t(I18N_KEYS.PAYMENT_SLIP_ERROR);
            notify(message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="block text-sm font-semibold text-slate-800" htmlFor="slip-upload">
                    {t(I18N_KEYS.PAYMENT_SLIP_LABEL)}
                </label>
                <input
                    id="slip-upload"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null;
                        setFile(nextFile);
                    }}
                    className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    disabled={submitting}
                />
                {file ? (
                    <p className="mt-2 text-xs text-slate-500">{file.name}</p>
                ) : (
                    <p className="mt-2 text-xs text-slate-500">{t(I18N_KEYS.PAYMENT_SLIP_HINT)}</p>
                )}
            </div>
            <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting ? t(I18N_KEYS.COMMON_PROCESSING) : t(I18N_KEYS.PAYMENT_SLIP_SUBMIT)}
            </button>
        </form>
    );
}

export default SlipUpload;

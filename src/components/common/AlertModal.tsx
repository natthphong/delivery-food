import React from "react";
import Modal from "./Modal";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export type AlertModalProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
};

const AlertModal: React.FC<AlertModalProps> = ({
    open,
    onClose,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
}) => {
    const { t } = useI18n();

    const handleConfirm = () => {
        onConfirm?.();
        onClose();
    };

    const resolvedConfirm = confirmText ?? t(I18N_KEYS.COMMON_CONFIRM);
    const resolvedCancel = cancelText ?? t(I18N_KEYS.COMMON_CANCEL);

    const footer = (
        <div className="flex items-center gap-3">
            {cancelText && (
                <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    onClick={onClose}
                >
                    {resolvedCancel}
                </button>
            )}
            <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99]"
                onClick={handleConfirm}
            >
                {resolvedConfirm}
            </button>
        </div>
    );

    return (
        <Modal open={open} onClose={onClose} title={title} footer={footer} size="sm">
            <p className="text-sm leading-relaxed text-slate-600">{message}</p>
        </Modal>
    );
};

export default AlertModal;

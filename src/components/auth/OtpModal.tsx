import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@components/common/Modal";

export type OtpModalProps = {
    open: boolean;
    phone: string;
    error?: string;
    onClose: () => void;
    onVerify: (code: string) => void;
    submitting?: boolean;
    onResend?: () => void;
};

const BOXES = 6;

const OtpModal: React.FC<OtpModalProps> = ({ open, phone, error, onClose, onVerify, submitting, onResend }) => {
    const [values, setValues] = useState<string[]>(() => Array(BOXES).fill(""));
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (!open) return;
        setValues(Array(BOXES).fill(""));
        const timeout = setTimeout(() => {
            inputsRef.current[0]?.focus();
        }, 60);
        return () => clearTimeout(timeout);
    }, [open]);

    const code = useMemo(() => values.join(""), [values]);

    const handleChange = (index: number, nextValue: string) => {
        if (!/^\d?$/.test(nextValue)) return;
        setValues((prev) => {
            const copy = [...prev];
            copy[index] = nextValue;
            return copy;
        });
        if (nextValue && index < BOXES - 1) {
            requestAnimationFrame(() => inputsRef.current[index + 1]?.focus());
        }
    };

    const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Backspace" && !values[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
        if (event.key === "ArrowLeft" && index > 0) {
            event.preventDefault();
            inputsRef.current[index - 1]?.focus();
        }
        if (event.key === "ArrowRight" && index < BOXES - 1) {
            event.preventDefault();
            inputsRef.current[index + 1]?.focus();
        }
        if (event.key === "Enter" && code.length === BOXES) {
            event.preventDefault();
            onVerify(code);
        }
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
        const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, BOXES);
        if (!text) return;
        event.preventDefault();
        const next = Array(BOXES).fill("");
        for (let i = 0; i < text.length; i++) {
            next[i] = text[i];
        }
        setValues(next);
        const focusIndex = Math.min(text.length, BOXES - 1);
        requestAnimationFrame(() => inputsRef.current[focusIndex]?.focus());
    };

    const footer = (
        <div className="flex items-center justify-end gap-3">
            <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
                Cancel
            </button>
            <button
                type="button"
                onClick={() => onVerify(code)}
                disabled={code.length !== BOXES || submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" aria-hidden />
                )}
                Verify
            </button>
        </div>
    );

    return (
        <Modal open={open} onClose={onClose} title="Enter verification code" size="sm" footer={footer}>
            <p className="text-sm text-slate-600">
                We sent a 6-digit code to <span className="font-medium text-slate-800">{phone}</span>.
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
                {Array.from({ length: BOXES }).map((_, index) => (
                    <input
                        key={index}
                        ref={(element) => (inputsRef.current[index] = element)}
                        className="h-12 w-12 rounded-xl border border-slate-200 text-center text-lg font-semibold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                        inputMode="numeric"
                        maxLength={1}
                        value={values[index]}
                        onChange={(event) => handleChange(index, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(index, event)}
                        onPaste={handlePaste}
                        aria-label={`Digit ${index + 1}`}
                    />
                ))}
            </div>
            {onResend && (
                <button
                    type="button"
                    onClick={onResend}
                    className="mt-4 inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                    Resend code
                </button>
            )}
            {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        </Modal>
    );
};

export default OtpModal;

import React, { useMemo, useRef, useState } from "react";
import OtpModal from "@components/auth/OtpModal";

export type PhoneAuthSectionProps = {
    mode: "login" | "signup";
    onSendOtp: (phone: string) => Promise<void>;
    onConfirmOtp: (code: string) => Promise<void>;
    submitting: boolean;
    buttonId?: string;
};

const sanitizePhone = (input: string): string => {
    let next = input.replace(/[^\d+]/g, "");
    if (next.startsWith("+")) {
        next = "+" + next.slice(1).replace(/\+/g, "");
    } else {
        next = next.replace(/\+/g, "");
    }
    if (next.length > 16) next = next.slice(0, 16);
    return next;
};

const PhoneAuthSection: React.FC<PhoneAuthSectionProps> = ({ mode, onSendOtp, onConfirmOtp, submitting, buttonId }) => {
    const [phone, setPhone] = useState("");
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [otpOpen, setOtpOpen] = useState(false);
    const [otpError, setOtpError] = useState<string | undefined>();
    const [activePhone, setActivePhone] = useState("");
    const isComposing = useRef(false);

    const placeholder = useMemo(
        () => (mode === "login" ? "Phone number (e.g. +66123456789)" : "Your phone number"),
        [mode]
    );

    const handleSendOtp = async () => {
        const normalized = sanitizePhone(phone);
        if (!/^[+]?[\d]{8,15}$/.test(normalized)) {
            setFieldError("Phone must be E.164 (e.g. +66123456789)");
            return;
        }

        setFieldError(null);
        setOtpError(undefined);
        try {
            await onSendOtp(normalized);
            setActivePhone(normalized);
            setOtpOpen(true);
        } catch (error) {
            const message = (error as Error)?.message || "Failed to send OTP";
            setFieldError(message);
        }
    };

    const handleVerify = async (code: string) => {
        try {
            await onConfirmOtp(code);
            setOtpOpen(false);
        } catch (error) {
            const message = (error as Error)?.message || "OTP confirmation failed";
            setOtpError(message);
        }
    };

    const handleResend = async () => {
        if (!activePhone) return;
        setOtpError(undefined);
        try {
            await onSendOtp(activePhone);
        } catch (error) {
            const message = (error as Error)?.message || "Failed to resend OTP";
            setOtpError(message);
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <label htmlFor="phone-input" className="text-xs font-medium text-slate-500">
                    Phone number
                </label>
                <input
                    id="phone-input"
                    type="tel"
                    value={phone}
                    onChange={(event) => {
                        const raw = event.target.value;
                        if (isComposing.current) {
                            setPhone(raw);
                            return;
                        }
                        setPhone(sanitizePhone(raw));
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                    placeholder={placeholder}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={16}
                    onCompositionStart={() => {
                        isComposing.current = true;
                    }}
                    onCompositionEnd={(event) => {
                        isComposing.current = false;
                        const cleaned = sanitizePhone((event.target as HTMLInputElement).value);
                        if (cleaned !== phone) setPhone(cleaned);
                        requestAnimationFrame(() => (event.target as HTMLInputElement).focus());
                    }}
                />
            </div>
            {fieldError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{fieldError}</div>
            )}
            <button
                type="button"
                onClick={handleSendOtp}
                disabled={submitting}
                id={buttonId}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-hidden />
                )}
                Send OTP
            </button>
            <p className="text-[11px] text-slate-500">On Firebase free plan, use test numbers (Auth → Phone → Testing).</p>

            <OtpModal
                open={otpOpen}
                phone={activePhone || phone}
                error={otpError}
                onClose={() => setOtpOpen(false)}
                onVerify={handleVerify}
                submitting={submitting}
                onResend={handleResend}
            />
        </div>
    );
};

export default PhoneAuthSection;

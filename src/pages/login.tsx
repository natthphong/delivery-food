import React, { useRef, useState, useMemo, useEffect } from "react";
import Layout from "@components/Layout";
import { auth, googleProvider, makeRecaptcha } from "@utils/firebaseClient";
import { signInWithEmailAndPassword, signInWithPopup, signInWithPhoneNumber } from "firebase/auth";
import axios from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import {logout, setTokens} from "@store/authSlice";
import { useRouter } from "next/router";
import {clearTokens, saveTokens} from "@utils/tokenStorage";

/* -----------------------------
   Atomic UI (move OUTSIDE page)
--------------------------------*/
type SegButtonProps = { active: boolean; children: React.ReactNode; onClick: () => void };
const SegButton = React.memo(function SegButton({ active, children, onClick }: SegButtonProps) {
    return (
        <button
            onClick={onClick}
            className={
                "flex-1 px-4 py-2 text-sm font-medium rounded-xl border transition " +
                (active ? "bg-white shadow-sm border-slate-200" : "bg-transparent hover:bg-white/60 border-transparent")
            }
            aria-pressed={active}
        >
            {children}
        </button>
    );
});

type LabeledInputProps = {
    id: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder: string;
    props?: React.InputHTMLAttributes<HTMLInputElement>;
};
const LabeledInput = React.memo(function LabeledInput({ id, type, value, onChange, placeholder, props }: LabeledInputProps) {
    return (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs text-slate-500">{placeholder}</label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                placeholder={placeholder}
                autoComplete={type === "password" ? "current-password" : "on"}
                {...props}
            />
        </div>
    );
});

type ActionBtnProps = { children: React.ReactNode; onClick: () => void; id?: string; disabled?: boolean };
const ActionBtn = React.memo(function ActionBtn({ children, onClick, id, disabled }: ActionBtnProps) {
    return (
        <button
            id={id}
            onClick={onClick}
            disabled={disabled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] transition px-4 py-2 disabled:opacity-60"
        >
            {children}
        </button>
    );
});

/* -----------------------------
   Page
--------------------------------*/
type Tab = "login" | "signup";

export default function LoginSignupPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>("login");

    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);

    // login fields
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // signup fields
    const [suEmail, setSuEmail] = useState("");
    const [suPassword, setSuPassword] = useState("");
    const [suPassword2, setSuPassword2] = useState("");
    const [suSendVerify, setSuSendVerify] = useState(true);

    // phone (both tabs)
    const [phone, setPhone] = useState(""); // sanitized, ไม่บล็อกการพิมพ์
    const [submitting, setSubmitting] = useState(false);

    // OTP
    const confirmRef = useRef<any>(null);
    const [otpOpen, setOtpOpen] = useState(false);
    const [otpErr, setOtpErr] = useState("");
    const otpBoxes = 6;
    const [otpArr, setOtpArr] = useState<string[]>(() => Array(otpBoxes).fill(""));
    const otpRefs = useRef<Array<HTMLInputElement | null>>(Array(otpBoxes).fill(null));

    // IME guard for phone
    const isComposing = useRef(false);
    function sanitizePhone(input: string): string {
        let next = input.replace(/[^\d+]/g, "");
        if (next.startsWith("+")) {
            next = "+" + next.slice(1).replace(/\+/g, "");
        } else {
            next = next.replace(/\+/g, "");
        }
        if (next.length > 16) next = next.slice(0, 16);
        return next;
    }

    function boot() {
        setMessage("");
        setOtpErr("");
        setLastError(null);
    }

    // ===== Helpers =====
    async function finishLogin(idToken: string) {
        const r = await axios.post("/api/login", { idToken });
        const tokens = { accessToken: r.data.accessToken, refreshToken: r.data.refreshToken };
        dispatch(setTokens(tokens));
        saveTokens(tokens);
        router.replace("/");
    }

    async function finishSignupWithIdToken(idToken: string, provider: "google" | "phone") {
        const r = await axios.post("/api/signup", { provider, idToken });
        const tokens = { accessToken: r.data.accessToken, refreshToken: r.data.refreshToken };
        dispatch(setTokens(tokens));
        saveTokens(tokens);
        router.replace("/");
    }

    const otpValue = useMemo(() => otpArr.join(""), [otpArr]);

    // ===== LOGIN FLOWS =====
    const onLoginEmail = async () => {
        try {
            boot(); setSubmitting(true);
            const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const idToken = await cred.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        } finally {
            setSubmitting(false);
        }
    };
    const onLoginLine = async () => {
        try {
            dispatch(logout());
            clearTokens();
            router.replace("/web-hook-line");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "LINE login failed");
        }
    };
    const onLoginGoogle = async () => {
        try {
            boot(); setSubmitting(true);
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        } finally {
            setSubmitting(false);
        }
    };

    const onLoginPhoneSend = async () => {
        try {
            boot(); setSubmitting(true);
            const normalized = sanitizePhone(phone);
            if (!/^[+]?[\d]{8,15}$/.test(normalized)) {
                throw new Error("Phone must be E.164 (e.g. +66123456789)");
            }
            const v = makeRecaptcha("btn-login-phone-otp");
            const conf = await signInWithPhoneNumber(auth, normalized, v);
            confirmRef.current = conf;
            setMessage("OTP sent.");
            openOtpModal();
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP send failed");
        } finally {
            setSubmitting(false);
        }
    };

    const doConfirmOtpLogin = async (code: string) => {
        try {
            setSubmitting(true);
            if (!confirmRef.current) throw new Error("Send OTP first.");
            if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit OTP");
            const r = await confirmRef.current.confirm(code);
            const idToken = await r.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setOtpErr(e?.message || "OTP confirm failed");
        } finally {
            setSubmitting(false);
        }
    };

    // ===== SIGNUP FLOWS =====
    const onSignupEmail = async () => {
        try {
            boot(); setSubmitting(true);
            if (!suEmail || !suPassword) throw new Error("Email and password required");
            if (suPassword !== suPassword2) throw new Error("Passwords do not match");
            const r = await axios.post("/api/signup", {
                provider: "password",
                email: suEmail,
                password: suPassword,
                sendVerifyEmail: suSendVerify,
            });
            const tokens = { accessToken: r.data.accessToken, refreshToken: r.data.refreshToken };
            dispatch(setTokens(tokens));
            saveTokens(tokens);
            try { await signInWithEmailAndPassword(auth, suEmail, suPassword); } catch { /* no-op */ }
            router.replace("/");
        } catch (e: any) {
            setLastError({ code: e?.response?.data?.code || e?.code, message: e?.response?.data?.error || e?.message });
            setMessage(e?.response?.data?.error || e?.message || "Signup failed");
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupGoogle = async () => {
        try {
            boot(); setSubmitting(true);
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await finishSignupWithIdToken(idToken, "google");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Signup failed");
        } finally {
            setSubmitting(false);
        }
    };

    const onSignupPhoneSend = async () => {
        try {
            boot(); setSubmitting(true);
            const normalized = sanitizePhone(phone);
            if (!/^[+]?[\d]{8,15}$/.test(normalized)) {
                throw new Error("Phone must be E.164 (e.g. +66123456789)");
            }
            const v = makeRecaptcha("btn-signup-phone-otp");
            const conf = await signInWithPhoneNumber(auth, normalized, v);
            confirmRef.current = conf;
            setMessage("OTP sent.");
            openOtpModal();
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP send failed");
        } finally {
            setSubmitting(false);
        }
    };

    const doConfirmOtpSignup = async (code: string) => {
        try {
            setSubmitting(true);
            if (!confirmRef.current) throw new Error("Send OTP first.");
            if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit OTP");
            const r = await confirmRef.current.confirm(code);
            const idToken = await r.user.getIdToken();
            await finishSignupWithIdToken(idToken, "phone");
        } catch (e: any) {
            setOtpErr(e?.message || "OTP confirm failed");
        } finally {
            setSubmitting(false);
        }
    };

    // ===== OTP Modal helpers =====
    function openOtpModal() {
        setOtpErr("");
        setOtpArr(Array(otpBoxes).fill(""));
        setOtpOpen(true);
    }
    function closeOtpModal() {
        setOtpOpen(false);
    }

    useEffect(() => {
        if (!otpOpen) return;
        const t = setTimeout(() => otpRefs.current[0]?.focus(), 60);
        return () => clearTimeout(t);
    }, [otpOpen]);

    function onOtpChange(i: number, val: string) {
        if (!/^\d?$/.test(val)) return;
        const next = [...otpArr];
        next[i] = val;
        setOtpArr(next);
        if (val && i < otpBoxes - 1) {
            requestAnimationFrame(() => setTimeout(() => otpRefs.current[i + 1]?.focus(), 0));
        }
    }
    function onOtpKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !otpArr[i] && i > 0) {
            otpRefs.current[i - 1]?.focus();
        }
        if (e.key === "ArrowLeft" && i > 0) {
            e.preventDefault(); otpRefs.current[i - 1]?.focus();
        }
        if (e.key === "ArrowRight" && i < otpBoxes - 1) {
            e.preventDefault(); otpRefs.current[i + 1]?.focus();
        }
    }
    function onOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
        const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpBoxes);
        if (!txt) return;
        const next = Array(otpBoxes).fill("");
        for (let j = 0; j < txt.length; j++) next[j] = txt[j];
        setOtpArr(next);
        const idx = Math.min(txt.length, otpBoxes - 1);
        setTimeout(() => otpRefs.current[idx]?.focus(), 0);
        e.preventDefault();
    }

    return (
        <Layout>
            <div className="min-h-[80vh] bg-gradient-to-b from-emerald-50/60 to-white flex items-center">
                <div className="w-full max-w-4xl mx-auto px-4">
                    {/* Brand header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium mb-3">
                            fresh • fast • foodie
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight">Welcome to FoodieGo</h1>
                        <p className="text-slate-500 mt-1">Sign {tab === "login" ? "in" : "up"} to get your favorites faster.</p>
                    </div>

                    {/* Card */}
                    <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-3xl shadow-sm p-2">
                        {/* Segmented tabs */}
                        <div className="flex bg-slate-100 rounded-2xl p-1 mb-4">
                            <SegButton active={tab === "login"} onClick={() => setTab("login")}>Login</SegButton>
                            <SegButton active={tab === "signup"} onClick={() => setTab("signup")}>Signup</SegButton>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 p-4 md:p-6">
                            {/* Left: Email & Password */}
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">Email &amp; Password</h2>

                                {tab === "login" ? (
                                    <div className="space-y-3">
                                        <LabeledInput id="login-email" type="email" value={loginEmail} onChange={(e)=>setLoginEmail(e.target.value)} placeholder="Email address" />
                                        <LabeledInput id="login-pass" type="password" value={loginPassword} onChange={(e)=>setLoginPassword(e.target.value)} placeholder="Password" />
                                        <ActionBtn disabled={submitting} onClick={onLoginEmail}>
                                            {submitting && <span className="animate-spin h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent" />}
                                            <span>Sign in</span>
                                        </ActionBtn>
                                        <p className="text-[11px] text-slate-500">By continuing, you agree to FoodieGo’s Terms & Privacy.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <LabeledInput id="su-email" type="email" value={suEmail} onChange={(e)=>setSuEmail(e.target.value)} placeholder="Email address" />
                                        <LabeledInput id="su-pass1" type="password" value={suPassword} onChange={(e)=>setSuPassword(e.target.value)} placeholder="Create password" />
                                        <LabeledInput id="su-pass2" type="password" value={suPassword2} onChange={(e)=>setSuPassword2(e.target.value)} placeholder="Confirm password" />
                                        <label className="text-sm flex items-center gap-2">
                                            <input type="checkbox" checked={suSendVerify} onChange={(e)=>setSuSendVerify(e.target.checked)} />
                                            Send verification email
                                        </label>
                                        <ActionBtn disabled={submitting} onClick={onSignupEmail}>
                                            {submitting && <span className="animate-spin h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent" />}
                                            <span>Create account</span>
                                        </ActionBtn>
                                        <p className="text-[11px] text-slate-500">We’ll email a verification link. You can complete it later.</p>
                                    </div>
                                )}
                            </div>

                            {/* Right: Providers */}
                            <div className="rounded-2xl border border-slate-200 p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4">Quick sign {tab === "login" ? "in" : "up"}</h2>

                                {/* Line */}
                                <ActionBtn disabled={submitting} onClick={onLoginLine}>
                                    <img src="/line-icon.svg" alt="LINE" className="h-4 w-4" />
                                    <span>Continue with LINE</span>
                                </ActionBtn>

                                {/* Google */}
                                <ActionBtn disabled={submitting} onClick={tab==="login" ? onLoginGoogle : onSignupGoogle}>
                                    <svg viewBox="0 0 533.5 544.3" className="h-4 w-4" aria-hidden>
                                        <path d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.4h146.9c-6.3 34.3-25.2 63.3-53.7 82.7v68h86.9c50.8-46.8 80.4-116 80.4-195.7z" fill="#4285F4"/>
                                        <path d="M272 544.3c72.9 0 134.2-24.1 178.9-65.6l-86.9-68c-24.1 16.2-55 25.9-92 25.9-70.7 0-130.7-47.7-152.1-111.8H30.7v70.2C75.1 486.3 167.8 544.3 272 544.3z" fill="#34A853"/>
                                        <path d="M119.9 325c-10.1-30.3-10.1-63.3 0-93.6V161.2H30.7c-41.3 82.6-41.3 179.3 0 261.9l-89.2-70.2z" fill="#FBBC05"/>
                                        <path d="M272 107.7c39.6-.6 77.4 14.8 106.4 42.7l79.7-79.7C404.4 24.3 343.4-.1 272 0 167.8 0 75.1 58 30.7 161.2l89.2 70.2C141.3 155.3 201.3 107.7 272 107.7z" fill="#EA4335"/>
                                    </svg>
                                    <span>Continue with Google</span>
                                </ActionBtn>

                                {/* Phone */}
                                <div className="mt-4 space-y-3">
                                    <LabeledInput
                                        id="phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (isComposing.current) {
                                                if (raw !== phone) setPhone(raw);
                                                return;
                                            }
                                            const cleaned = sanitizePhone(raw);
                                            if (cleaned !== phone) setPhone(cleaned);
                                        }}
                                        placeholder="Phone number (e.g. +66123456789)"
                                        props={{
                                            inputMode: "tel",
                                            autoComplete: "tel",
                                            maxLength: 16,
                                            onCompositionStart: () => { isComposing.current = true; },
                                            onCompositionEnd: (e) => {
                                                isComposing.current = false;
                                                const cleaned = sanitizePhone((e.target as HTMLInputElement).value);
                                                if (cleaned !== phone) setPhone(cleaned);
                                                requestAnimationFrame(() => (e.target as HTMLInputElement).focus());
                                            },
                                        }}
                                    />
                                    <div className="flex items-center gap-2">
                                        <ActionBtn
                                            id={tab==="login" ? "btn-login-phone-otp" : "btn-signup-phone-otp"}
                                            onClick={tab==="login" ? onLoginPhoneSend : onSignupPhoneSend}
                                            disabled={submitting}
                                        >
                                            {submitting && <span className="animate-spin h-4 w-4 rounded-full border-2 border-slate-300 border-t-transparent" />}
                                            <span>Send OTP</span>
                                        </ActionBtn>
                                    </div>
                                    <p className="text-[11px] text-slate-500">On Firebase free plan, use test numbers (Auth → Phone → Testing).</p>
                                </div>
                            </div>
                        </div>

                        {/* Alerts */}
                        <div className="px-4 pb-4 md:px-6">
                            {!!message && (
                                <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{message}</div>
                            )}
                            {!!lastError && (
                                <pre className="mt-3 text-xs p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl overflow-x-auto">
{JSON.stringify(lastError, null, 2)}
                </pre>
                            )}
                        </div>
                    </div>

                    {/* Footer micro-copy */}
                    <div className="text-center text-xs text-slate-500 mt-6">
                        © {new Date().getFullYear()} FoodieGo. Fresh to your door.
                    </div>
                </div>
            </div>

            {/* OTP Modal */}
            {otpOpen && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeOtpModal} />
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 relative">
                            <button
                                className="absolute right-3 top-3 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                                onClick={closeOtpModal}
                                aria-label="Close"
                            >
                                ✕
                            </button>
                            <h3 className="text-xl font-semibold">Enter verification code</h3>
                            <p className="text-sm text-slate-500 mt-1">We sent a 6-digit code to <span className="font-medium">{phone}</span>.</p>

                            <div className="mt-4 flex items-center justify-between gap-2">
                                {Array.from({ length: otpBoxes }).map((_, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (otpRefs.current[i] = el)}
                                        className="w-12 h-12 text-center text-lg font-semibold rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={otpArr[i]}
                                        onChange={(e) => onOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => onOtpKeyDown(i, e)}
                                        onPaste={(e) => {
                                            const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpBoxes);
                                            if (!txt) return;
                                            const next = Array(otpBoxes).fill("");
                                            for (let j = 0; j < txt.length; j++) next[j] = txt[j];
                                            setOtpArr(next);
                                            const idx = Math.min(txt.length, otpBoxes - 1);
                                            setTimeout(() => otpRefs.current[idx]?.focus(), 0);
                                            e.preventDefault();
                                        }}
                                    />
                                ))}
                            </div>

                            {otpErr && <div className="mt-3 rounded-xl p-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm">{otpErr}</div>}

                            <div className="mt-5 flex items-center justify-between">
                                <button
                                    className="text-sm px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                                    onClick={tab === "login" ? onLoginPhoneSend : onSignupPhoneSend}
                                >
                                    Resend code
                                </button>
                                <ActionBtn
                                    onClick={async () => {
                                        const code = otpValue;
                                        if (tab === "login") await doConfirmOtpLogin(code);
                                        else await doConfirmOtpSignup(code);
                                    }}
                                    disabled={submitting || !/^\d{6}$/.test(otpValue)}
                                >
                                    {submitting && <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/60 border-t-transparent" />}
                                    Verify
                                </ActionBtn>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

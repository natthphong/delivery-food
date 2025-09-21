import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setUser } from "@store/authSlice";
import { linkWithPhoneNumber, signInWithPhoneNumber, signOut } from "firebase/auth";
import { clearTokens, clearUser, saveUser } from "@utils/tokenStorage";
import { useRouter } from "next/router";

type Me = {
    id: number;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean;
    is_phone_verified: boolean;
};

type AccountUpdatePayload = {
    email?: string | null;
    phone?: string | null;
    is_email_verified?: boolean | null;
    is_phone_verified?: boolean | null;
};

type UserEnvelope = { user?: any };

type AccountUpdateResponse = ApiResponse<UserEnvelope>;
type SendVerifyEmailResponse = ApiResponse<{ ok: boolean }>;

function normalizeUser(payload: any | null | undefined): Me {
    return {
        id: typeof payload?.id === "number" ? payload.id : 0,
        email: payload?.email ?? null,
        phone: payload?.phone ?? null,
        provider: payload?.provider ?? null,
        is_email_verified: Boolean(payload?.is_email_verified),
        is_phone_verified: Boolean(payload?.is_phone_verified),
    };
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
        >
            {label}
        </span>
    );
}

export default function AccountPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<string>("");
    const [error, setError] = useState<string>("");

    const [newEmail, setNewEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");

    const [updatingEmail, setUpdatingEmail] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [confirmingOtp, setConfirmingOtp] = useState(false);

    const confirmRef = useRef<any>(null);

    const providerLabel = useMemo(() => {
        if (!me?.provider) return "-";
        return me.provider;
    }, [me]);

    const fetchMe = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get<ApiResponse<UserEnvelope>>("/api/user/me");
            if (r.data.code !== "OK") {
                throw new Error(r.data.message || "Failed to load profile");
            }
            const user = r.data.body?.user;
            if (!user) {
                throw new Error("Invalid profile response");
            }
            setMe(normalizeUser(user));
            dispatch(setUser(user));
            saveUser(user);
            setError("");
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to load profile");
            setMe(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMe().catch(() => {});
    }, [fetchMe]);

    async function updateAccount(patch: AccountUpdatePayload) {
        const response = await axios.post<AccountUpdateResponse>("/api/v1/account/update", patch);
        if (response.data.code !== "OK") {
            throw new Error(response.data.message || "Account update failed");
        }
        const user = response.data.body?.user;
        if (!user) {
            throw new Error("Invalid account response");
        }
        setMe(normalizeUser(user));
        dispatch(setUser(user));
        saveUser(user);
    }

    async function handleVerifyEmail() {
        setError("");
        setMessage("");
        try {
            if (!auth.currentUser) {
                throw new Error("No Firebase session. Please re-login.");
            }
            setVerifyingEmail(true);
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                await updateAccount({ is_email_verified: true });
                setMessage("Email verified successfully.");
            } else {
                const idToken = await auth.currentUser.getIdToken();
                const response = await axios.post<SendVerifyEmailResponse>("/api/user/send-verify-email", { idToken });
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || "Failed to send verification email");
                }
                setMessage(
                    "Verification email sent. After verifying, click \"Verify email\" again to refresh your status."
                );
            }
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to process email verification");
        } finally {
            setVerifyingEmail(false);
        }
    }

    async function handleChangeEmail() {
        setError("");
        setMessage("");
        try {
            const trimmed = newEmail.trim();
            if (!trimmed) {
                throw new Error("New email required");
            }
            if (!auth.currentUser) {
                throw new Error("No Firebase session. Please re-login.");
            }
            setUpdatingEmail(true);
            await updateAccount({ email: trimmed });
            setMessage("Email updated. Please verify your email address.");
            setNewEmail("");
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Failed to update email");
        } finally {
            setUpdatingEmail(false);
        }
    }

    async function handleSendOtp() {
        setError("");
        setMessage("");
        try {
            const trimmed = phone.trim();
            if (!trimmed) {
                throw new Error("Phone number required");
            }
            setSendingOtp(true);
            const verifier = makeRecaptcha("btn-send-otp");
            const confirmation = await signInWithPhoneNumber(auth, trimmed, verifier);
            confirmRef.current = confirmation;
            setMessage("OTP sent to your phone.");
            setOtp("");
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.code || e?.message || "Failed to send OTP");
        } finally {
            setSendingOtp(false);
        }
    }

    async function handleConfirmOtp() {
        setError("");
        setMessage("");
        try {
            const confirmation = confirmRef.current;
            if (!confirmation) {
                throw new Error("No OTP session. Send OTP first.");
            }
            const code = otp.trim();
            if (!code) {
                throw new Error("Enter the OTP");
            }
            setConfirmingOtp(true);
            await confirmation.confirm(code);
            const trimmedPhone = phone.trim();
            await updateAccount({ phone: trimmedPhone || null, is_phone_verified: true });
            setMessage("Phone linked & verified.");
            setPhone("");
            setOtp("");
            confirmRef.current = null;
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.code || e?.message || "Failed to confirm OTP");
        } finally {
            setConfirmingOtp(false);
        }
    }

    async function handleLogout() {
        await signOut(auth).catch(() => {});
        dispatch(logout());
        clearTokens();
        clearUser();
        router.replace("/login");
    }

    return (
        <Layout>
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900">My Account</h1>
                    <p className="text-sm text-slate-500">Manage your contact &amp; verification details.</p>
                </div>

                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
                            <p className="text-xs text-slate-500">
                                Provider: <span className="font-mono text-slate-700">{providerLabel}</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                        >
                            Logout
                        </button>
                    </div>

                    {loading ? (
                        <p className="mt-4 text-sm text-slate-500">Loading…</p>
                    ) : me ? (
                        <div className="mt-4 space-y-4">
                            <div>
                                <div className="text-sm text-slate-500">Email</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium text-slate-900">{me.email || "-"}</div>
                                    <Chip
                                        ok={me.is_email_verified}
                                        label={me.is_email_verified ? "Verified" : "Not verified"}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-slate-500">Phone</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium text-slate-900">{me.phone || "-"}</div>
                                    <Chip
                                        ok={me.is_phone_verified}
                                        label={me.is_phone_verified ? "Verified" : "Not verified"}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-rose-600">Failed to load profile.</p>
                    )}
                </div>

                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Verify &amp; Update</h3>
                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Email verification</p>
                                    <p className="text-xs text-slate-500">
                                        Send a verification email or refresh your status after confirming.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleVerifyEmail}
                                    disabled={verifyingEmail || !me?.email}
                                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {verifyingEmail ? "Processing…" : "Verify email"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">Change email</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="email"
                                    placeholder="new-email@example.com"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                />
                                <button
                                    type="button"
                                    onClick={handleChangeEmail}
                                    disabled={updatingEmail || !newEmail.trim()}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {updatingEmail ? "Updating…" : "Update"}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Firebase may require a recent login before allowing an email change.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-700">Link / verify phone</p>
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                                <input
                                    type="tel"
                                    placeholder="+66123456789"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 lg:max-w-sm"
                                />
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <button
                                        id="btn-send-otp"
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={sendingOtp || !phone.trim()}
                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {sendingOtp ? "Sending…" : "Send OTP"}
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 sm:w-28"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleConfirmOtp}
                                        disabled={confirmingOtp || !otp.trim()}
                                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {confirmingOtp ? "Confirming…" : "Confirm"}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Use Firebase test numbers on the free plan to avoid billing errors.
                            </p>
                        </div>
                    </div>
                </div>

                {!!message && (
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {message}
                    </div>
                )}
                {!!error && (
                    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        {error}
                    </div>
                )}
            </div>
        </Layout>
    );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setTokens } from "@store/authSlice";
import { linkWithPhoneNumber, signOut, updateEmail } from "firebase/auth";

type Me = {
    id: number;
    email: string | null;
    phone: string | null;
    provider: string | null;
    is_email_verified: boolean;
    is_phone_verified: boolean;
};

type AuthTokens = { accessToken: string; refreshToken: string };

function extractTokens(body: { accessToken?: string | null; refreshToken?: string | null } | null | undefined): AuthTokens {
    if (!body?.accessToken || !body?.refreshToken) {
        throw new Error("Invalid authentication response");
    }
    return {
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
    };
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                ok ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}
        >
            {label}
        </span>
    );
}

export default function AccountPage() {
    const dispatch = useAppDispatch();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState<string>("");
    const [err, setErr] = useState<string>("");

    // change email
    const [newEmail, setNewEmail] = useState("");
    // phone link
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const confirmRef = useRef<any>(null);

    const providerLabel = useMemo(() => {
        if (!me?.provider) return "-";
        return me.provider;
    }, [me]);

    async function fetchMe() {
        setLoading(true);
        setErr("");
        setMsg("");
        try {
            const r = await axios.get<ApiResponse<{ user: Me }>>("/api/user/me");
            const user = r.data.body?.user;
            if (!user) {
                throw new Error("Invalid profile response");
            }
            setMe(user);
        } catch (e: any) {
            setErr(e?.response?.data?.message || e?.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchMe();
    }, []);

    async function resendVerifyEmail() {
        setErr("");
        setMsg("");
        try {
            const idToken = await auth.currentUser?.getIdToken(true);
            if (!idToken) throw new Error("No firebase session; please re-login");
            await axios.post("/api/user/send-verify-email", { idToken });
            setMsg("Verification email sent.");
        } catch (e: any) {
            setErr(e?.response?.data?.message || e?.message || "Failed to send verification email");
        }
    }

    async function onChangeEmail() {
        setErr("");
        setMsg("");
        try {
            if (!newEmail) throw new Error("New email required");
            if (!auth.currentUser) throw new Error("No firebase session; please re-login");
            await updateEmail(auth.currentUser, newEmail);
            const idToken = await auth.currentUser.getIdToken(true);
            const r = await axios.post<ApiResponse<AuthTokens & { user: Me }>>(
                "/api/login",
                { idToken }
            );
            const tokens = extractTokens(r.data.body);
            dispatch(setTokens(tokens));
            setMsg("Email updated. If required, please verify via email.");
            setNewEmail("");
            await fetchMe();
        } catch (e: any) {
            setErr(e?.response?.data?.message || e?.code || e?.message || "Failed to update email");
        }
    }

    async function onPhoneSendOtp() {
        setErr("");
        setMsg("");
        try {
            if (!phone) throw new Error("Phone number required");
            if (!auth.currentUser) throw new Error("Please login again");
            const verifier = makeRecaptcha("btn-send-otp");
            const confirmation = await linkWithPhoneNumber(auth.currentUser, phone, verifier);
            confirmRef.current = confirmation;
            setMsg("OTP sent to your phone.");
            setOtp("");
        } catch (e: any) {
            setErr(e?.code || e?.message || "Failed to send OTP");
        }
    }

    async function onPhoneConfirmOtp() {
        setErr("");
        setMsg("");
        try {
            const confirmation = confirmRef.current;
            if (!confirmation) throw new Error("No OTP session. Send OTP first.");
            if (!otp) throw new Error("Enter the OTP");
            await confirmation.confirm(otp);
            const idToken = await auth.currentUser?.getIdToken(true);
            if (!idToken) throw new Error("No firebase session after phone link");
            const r = await axios.post<ApiResponse<AuthTokens & { user: Me }>>(
                "/api/login",
                { idToken }
            );
            const tokens = extractTokens(r.data.body);
            dispatch(setTokens(tokens));
            setMsg("Phone linked & verified.");
            setPhone("");
            setOtp("");
            confirmRef.current = null;
            await fetchMe();
        } catch (e: any) {
            setErr(e?.response?.data?.message || e?.code || e?.message || "Failed to confirm OTP");
        }
    }

    async function onLogout() {
        await signOut(auth).catch(() => {});
        dispatch(logout());
        window.location.href = "/login";
    }

    return (
        <Layout>
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">My Account</h1>
                    <p className="text-sm text-gray-500">Manage your contact &amp; verification details.</p>
                </div>

                {/* Card: Profile */}
                <div className="bg-white border rounded-2xl shadow-sm p-6 mb-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Profile</h2>
                            <p className="text-xs text-gray-500">
                                Provider: <span className="font-mono">{providerLabel}</span>
                            </p>
                        </div>
                        <button onClick={onLogout} className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50">
                            Logout
                        </button>
                    </div>

                    {loading ? (
                        <p className="mt-4 text-gray-500">Loading…</p>
                    ) : me ? (
                        <div className="mt-4 space-y-4">
                            <div>
                                <div className="text-sm text-gray-500">Email</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium">{me.email || "-"}</div>
                                    <Chip ok={me.is_email_verified} label={me.is_email_verified ? "Verified" : "Not verified"} />
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500">Phone</div>
                                <div className="flex items-center gap-2">
                                    <div className="font-medium">{me.phone || "-"}</div>
                                    <Chip ok={me.is_phone_verified} label={me.is_phone_verified ? "Verified" : "Not verified"} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-red-600">Failed to load profile.</p>
                    )}
                </div>

                {/* Card: Actions */}
                <div className="bg-white border rounded-2xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4">Verify &amp; Update</h3>

                    {/* Resend Email Verify */}
                    <div className="mb-4">
                        <div className="text-sm font-medium mb-1">Email verification</div>
                        <button onClick={resendVerifyEmail} className="px-4 py-2 rounded-xl border hover:bg-gray-50">
                            Resend verification email
                        </button>
                    </div>

                    {/* Change Email */}
                    <div className="mb-4">
                        <div className="text-sm font-medium mb-1">Change email</div>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                placeholder="new-email@example.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="border rounded-xl px-3 py-2 flex-1"
                            />
                            <button onClick={onChangeEmail} className="px-4 py-2 rounded-xl border hover:bg-gray-50">
                                Update
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            May require recent sign-in depending on provider.
                        </p>
                    </div>

                    {/* Link Phone */}
                    <div className="mb-2">
                        <div className="text-sm font-medium mb-1">Link / verify phone</div>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="tel"
                                placeholder="+66123456789"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="border rounded-xl px-3 py-2 flex-1"
                            />
                            <button id="btn-send-otp" onClick={onPhoneSendOtp} className="px-4 py-2 rounded-xl border hover:bg-gray-50">
                                Send OTP
                            </button>
                            <input
                                type="text"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="border rounded-xl px-3 py-2 w-28"
                            />
                            <button onClick={onPhoneConfirmOtp} className="px-4 py-2 rounded-xl border hover:bg-gray-50">
                                Confirm
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Use Firebase test numbers on free plan to avoid billing errors.
                        </p>
                    </div>
                </div>

                {/* Alerts */}
                {!!msg && (
                    <div className="rounded-xl p-3 bg-green-50 border border-green-200 text-green-700 mb-3">{msg}</div>
                )}
                {!!err && (
                    <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-red-700">{err}</div>
                )}
            </div>
        </Layout>
    );
}

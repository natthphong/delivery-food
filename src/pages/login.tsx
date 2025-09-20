// src/pages/login.tsx
import React, { useRef, useState } from "react";
import Layout from "@components/Layout";
import { auth, googleProvider, makeRecaptcha } from "@utils/firebaseClient";
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithPhoneNumber,
} from "firebase/auth";
import axios from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import { setTokens } from "@store/authSlice";

type Tab = "login" | "signup";

const LoginSignupPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const [tab, setTab] = useState<Tab>("login");

    // shared UI
    const [message, setMessage] = useState("");
    const [lastError, setLastError] = useState<{ code?: string; message?: string } | null>(null);

    // login (email/pw)
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // signup (email/pw)
    const [suEmail, setSuEmail] = useState("");
    const [suPassword, setSuPassword] = useState("");
    const [suPassword2, setSuPassword2] = useState("");
    const [suSendVerify, setSuSendVerify] = useState(true);

    // phone (both tabs)
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const confirmationResultRef = useRef<any>(null);

    function boot() {
        setLastError(null);
        setMessage("");
    }

    // ---------- LOGIN FLOWS ----------
    async function completeLoginBackend(idToken: string) {
        const r = await axios.post("/api/login", { idToken });
        dispatch(setTokens({ accessToken: r.data.accessToken, refreshToken: r.data.refreshToken }));
        setMessage("Login success");
        window.location.href = "/";
    }

    const onLoginEmail = async () => {
        try {
            boot();
            console.log("[login] email/password start");
            const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const idToken = await cred.user.getIdToken();
            await completeLoginBackend(idToken);
        } catch (e: any) {
            console.error("[login] email/password error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        }
    };

    const onLoginGoogle = async () => {
        try {
            boot();
            console.log("[login] Google");
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await completeLoginBackend(idToken);
        } catch (e: any) {
            console.error("[login] Google error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        }
    };

    const onLoginPhoneRequestOtp = async () => {
        try {
            boot();
            console.log("[login] phone request OTP", { phone });
            const verifier = makeRecaptcha("btn-login-phone-otp");
            const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
            confirmationResultRef.current = confirmation;
            setMessage("OTP sent.");
        } catch (e: any) {
            console.error("[login] phone request OTP error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(`${e?.code || "error"}: ${e?.message || "OTP request failed"}`);
        }
    };

    const onLoginPhoneConfirmOtp = async () => {
        try {
            boot();
            console.log("[login] phone confirm OTP");
            const confirmation = confirmationResultRef.current;
            if (!confirmation) throw new Error("No OTP session. Request OTP first.");
            const result = await confirmation.confirm(otp);
            const idToken = await result.user.getIdToken();
            await completeLoginBackend(idToken);
        } catch (e: any) {
            console.error("[login] phone confirm error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(`${e?.code || "error"}: ${e?.message || "OTP confirm failed"}`);
        }
    };

    // ---------- SIGNUP FLOWS ----------
    async function completeSignupBackendWithIdToken(idToken: string) {
        const r = await axios.post("/api/signup", { provider: "google", idToken }); // provider ignored; server uses token info
        dispatch(setTokens({ accessToken: r.data.accessToken, refreshToken: r.data.refreshToken }));
        setMessage("Signup success");
        window.location.href = "/";
    }

    const onSignupEmail = async () => {
        try {
            boot();
            if (!suEmail || !suPassword) throw new Error("Email and password are required");
            if (suPassword !== suPassword2) throw new Error("Passwords do not match");

            console.log("[signup] email/password via API");
            const r = await axios.post("/api/signup", {
                provider: "password",
                email: suEmail,
                password: suPassword,
                sendVerifyEmail: suSendVerify,
            });
            dispatch(setTokens({ accessToken: r.data.accessToken, refreshToken: r.data.refreshToken }));
            setMessage("Signup success");
            window.location.href = "/";
        } catch (e: any) {
            console.error("[signup] email/password API error", e);
            setLastError({ code: e?.response?.data?.code || e?.code, message: e?.response?.data?.error || e?.message });
            setMessage(e?.response?.data?.error || e?.message || "Signup failed");
        }
    };

    const onSignupGoogle = async () => {
        try {
            boot();
            console.log("[signup] Google");
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await completeSignupBackendWithIdToken(idToken);
        } catch (e: any) {
            console.error("[signup] Google error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Signup failed");
        }
    };

    const onSignupPhoneRequestOtp = async () => {
        try {
            boot();
            console.log("[signup] phone request OTP");
            const verifier = makeRecaptcha("btn-signup-phone-otp");
            const confirmation = await signInWithPhoneNumber(auth, phone, verifier);
            confirmationResultRef.current = confirmation;
            setMessage("OTP sent.");
        } catch (e: any) {
            console.error("[signup] phone request OTP error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(`${e?.code || "error"}: ${e?.message || "OTP request failed"}`);
        }
    };

    const onSignupPhoneConfirmOtp = async () => {
        try {
            boot();
            console.log("[signup] phone confirm OTP");
            const confirmation = confirmationResultRef.current;
            if (!confirmation) throw new Error("No OTP session. Request OTP first.");
            const result = await confirmation.confirm(otp);
            const idToken = await result.user.getIdToken();
            // call signup API (stamps & issues our tokens)
            const r = await axios.post("/api/signup", { provider: "phone", idToken });
            dispatch(setTokens({ accessToken: r.data.accessToken, refreshToken: r.data.refreshToken }));
            setMessage("Signup success");
            window.location.href = "/";
        } catch (e: any) {
            console.error("[signup] phone confirm error", e);
            setLastError({ code: e?.code, message: e?.message });
            setMessage(`${e?.code || "error"}: ${e?.message || "OTP confirm failed"}`);
        }
    };

    return (
        <Layout>
            <h1 className="text-2xl font-semibold mb-6">Login / Signup</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    className={`px-4 py-2 border rounded ${tab === "login" ? "bg-gray-100" : ""}`}
                    onClick={() => setTab("login")}
                >
                    Login
                </button>
                <button
                    className={`px-4 py-2 border rounded ${tab === "signup" ? "bg-gray-100" : ""}`}
                    onClick={() => setTab("signup")}
                >
                    Signup
                </button>
            </div>

            {tab === "login" ? (
                <>
                    {/* LOGIN: Email/Password */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Email &amp; Password</h2>
                        <input
                            type="email"
                            placeholder="email@example.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <button onClick={onLoginEmail} className="px-4 py-2 border rounded">Sign in</button>
                    </div>

                    {/* LOGIN: Google */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Google</h2>
                        <button onClick={onLoginGoogle} className="px-4 py-2 border rounded">Continue with Google</button>
                    </div>

                    {/* LOGIN: Phone */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Phone (OTP)</h2>
                        <input
                            type="tel"
                            placeholder="+66123456789"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <div className="flex gap-2">
                            <button id="btn-login-phone-otp" onClick={onLoginPhoneRequestOtp} className="px-4 py-2 border rounded">
                                Send OTP
                            </button>
                            <input
                                type="text"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="border px-3 py-2"
                            />
                            <button onClick={onLoginPhoneConfirmOtp} className="px-4 py-2 border rounded">
                                Confirm OTP
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* SIGNUP: Email/Password (server API) */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Email &amp; Password (Signup)</h2>
                        <input
                            type="email"
                            placeholder="email@example.com"
                            value={suEmail}
                            onChange={(e) => setSuEmail(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <input
                            type="password"
                            placeholder="Create password"
                            value={suPassword}
                            onChange={(e) => setSuPassword(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <input
                            type="password"
                            placeholder="Confirm password"
                            value={suPassword2}
                            onChange={(e) => setSuPassword2(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <label className="flex items-center gap-2 mb-3">
                            <input
                                type="checkbox"
                                checked={suSendVerify}
                                onChange={e => setSuSendVerify(e.target.checked)}
                            />
                            Send verification email
                        </label>
                        <button onClick={onSignupEmail} className="px-4 py-2 border rounded">Create account</button>
                    </div>

                    {/* SIGNUP: Google */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Google</h2>
                        <button onClick={onSignupGoogle} className="px-4 py-2 border rounded">Continue with Google</button>
                    </div>

                    {/* SIGNUP: Phone */}
                    <div className="mb-6 p-4 border rounded">
                        <h2 className="font-medium mb-2">Phone (OTP)</h2>
                        <input
                            type="tel"
                            placeholder="+66123456789"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="border px-3 py-2 mb-2 w-full"
                        />
                        <div className="flex gap-2">
                            <button id="btn-signup-phone-otp" onClick={onSignupPhoneRequestOtp} className="px-4 py-2 border rounded">
                                Send OTP
                            </button>
                            <input
                                type="text"
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="border px-3 py-2"
                            />
                            <button onClick={onSignupPhoneConfirmOtp} className="px-4 py-2 border rounded">
                                Confirm OTP
                            </button>
                        </div>
                    </div>
                </>
            )}

            {message && <p className="text-sm text-gray-700">{message}</p>}
            {lastError && (
                <pre className="text-xs mt-3 p-2 bg-gray-100 border rounded overflow-x-auto">
{JSON.stringify(lastError, null, 2)}
        </pre>
            )}
        </Layout>
    );
};

export default LoginSignupPage;

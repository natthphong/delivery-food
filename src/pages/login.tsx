import React, { useRef, useState } from "react";
import Layout from "@components/Layout";
import { auth, googleProvider, makeRecaptcha } from "@utils/firebaseClient";
import { signInWithEmailAndPassword, signInWithPopup, signInWithPhoneNumber } from "firebase/auth";
import axios from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import { setTokens } from "@store/authSlice";
import { useRouter } from "next/router";
import { saveTokens } from "@utils/tokenStorage";

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
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const confirmRef = useRef<any>(null);

    function boot() {
        setMessage("");
        setLastError(null);
    }

    // backend helpers
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

    // LOGIN FLOWS
    const onLoginEmail = async () => {
        try {
            boot();
            const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const idToken = await cred.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        }
    };
    const onLoginGoogle = async () => {
        try {
            boot();
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Login failed");
        }
    };
    const onLoginPhoneSend = async () => {
        try {
            boot();
            if (!phone) throw new Error("Phone number required");
            const v = makeRecaptcha("btn-login-phone-otp");
            const conf = await signInWithPhoneNumber(auth, phone, v);
            confirmRef.current = conf;
            setMessage("OTP sent.");
            setOtp("");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP send failed");
        }
    };
    const onLoginPhoneConfirm = async () => {
        try {
            boot();
            const conf = confirmRef.current;
            if (!conf) throw new Error("Send OTP first.");
            if (!otp) throw new Error("Enter the OTP");
            const r = await conf.confirm(otp);
            const idToken = await r.user.getIdToken();
            await finishLogin(idToken);
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP confirm failed");
        }
    };

    // SIGNUP FLOWS
    const onSignupEmail = async () => {
        try {
            boot();
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
            try {
                await signInWithEmailAndPassword(auth, suEmail, suPassword);
            } catch {
                // best-effort: user may need to login again to refresh Firebase session
            }
            router.replace("/");
        } catch (e: any) {
            setLastError({ code: e?.response?.data?.code || e?.code, message: e?.response?.data?.error || e?.message });
            setMessage(e?.response?.data?.error || e?.message || "Signup failed");
        }
    };
    const onSignupGoogle = async () => {
        try {
            boot();
            const cred = await signInWithPopup(auth, googleProvider);
            const idToken = await cred.user.getIdToken();
            await finishSignupWithIdToken(idToken, "google");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "Signup failed");
        }
    };
    const onSignupPhoneSend = async () => {
        try {
            boot();
            if (!phone) throw new Error("Phone number required");
            const v = makeRecaptcha("btn-signup-phone-otp");
            const conf = await signInWithPhoneNumber(auth, phone, v);
            confirmRef.current = conf;
            setMessage("OTP sent.");
            setOtp("");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP send failed");
        }
    };
    const onSignupPhoneConfirm = async () => {
        try {
            boot();
            const conf = confirmRef.current;
            if (!conf) throw new Error("Send OTP first.");
            if (!otp) throw new Error("Enter the OTP");
            const r = await conf.confirm(otp);
            const idToken = await r.user.getIdToken();
            await finishSignupWithIdToken(idToken, "phone");
        } catch (e: any) {
            setLastError({ code: e?.code, message: e?.message });
            setMessage(e?.message || "OTP confirm failed");
        }
    };

    return (
        <Layout>
            <div className="min-h-[70vh] flex items-center justify-center">
                <div className="w-full max-w-3xl">
                    {/* header brand */}
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold">Welcome to FoodieGo</h1>
                        <p className="text-gray-500 text-sm">Sign in to get your favorites faster.</p>
                    </div>

                    {/* tabs */}
                    <div className="mb-4 flex gap-2 justify-center">
                        <button
                            onClick={() => setTab("login")}
                            className={`px-4 py-2 rounded-xl border ${tab === "login" ? "bg-gray-100" : "hover:bg-gray-50"}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setTab("signup")}
                            className={`px-4 py-2 rounded-xl border ${tab === "signup" ? "bg-gray-100" : "hover:bg-gray-50"}`}
                        >
                            Signup
                        </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* card left: email/pw */}
                        <div className="bg-white border rounded-2xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-2">Email &amp; Password</h2>

                            {tab === "login" ? (
                                <>
                                    <input
                                        className="border w-full rounded-xl px-3 py-2 mb-2"
                                        type="email"
                                        placeholder="email@example.com"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                    />
                                    <input
                                        className="border w-full rounded-xl px-3 py-2 mb-3"
                                        type="password"
                                        placeholder="••••••••"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                    />
                                    <button onClick={onLoginEmail} className="px-4 py-2 rounded-xl border w-full hover:bg-gray-50">
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    <input
                                        className="border w-full rounded-xl px-3 py-2 mb-2"
                                        type="email"
                                        placeholder="email@example.com"
                                        value={suEmail}
                                        onChange={(e) => setSuEmail(e.target.value)}
                                    />
                                    <input
                                        className="border w-full rounded-xl px-3 py-2 mb-2"
                                        type="password"
                                        placeholder="Create password"
                                        value={suPassword}
                                        onChange={(e) => setSuPassword(e.target.value)}
                                    />
                                    <input
                                        className="border w-full rounded-xl px-3 py-2 mb-2"
                                        type="password"
                                        placeholder="Confirm password"
                                        value={suPassword2}
                                        onChange={(e) => setSuPassword2(e.target.value)}
                                    />
                                    <label className="text-sm flex items-center gap-2 mb-3">
                                        <input type="checkbox" checked={suSendVerify} onChange={(e) => setSuSendVerify(e.target.checked)} />
                                        Send verification email
                                    </label>
                                    <button onClick={onSignupEmail} className="px-4 py-2 rounded-xl border w-full hover:bg-gray-50">
                                        Create account
                                    </button>
                                </>
                            )}
                        </div>

                        {/* card right: providers */}
                        <div className="bg-white border rounded-2xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-2">Quick sign {tab === "login" ? "in" : "up"}</h2>
                            {/* Google */}
                            <button
                                onClick={tab === "login" ? onLoginGoogle : onSignupGoogle}
                                className="px-4 py-2 rounded-xl border w-full hover:bg-gray-50 mb-4"
                            >
                                Continue with Google
                            </button>

                            {/* Phone */}
                            <div className="space-y-2">
                                <input
                                    className="border w-full rounded-xl px-3 py-2"
                                    type="tel"
                                    placeholder="+66123456789"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        id={tab === "login" ? "btn-login-phone-otp" : "btn-signup-phone-otp"}
                                        onClick={tab === "login" ? onLoginPhoneSend : onSignupPhoneSend}
                                        className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                                    >
                                        Send OTP
                                    </button>
                                    <input
                                        className="border rounded-xl px-3 py-2 flex-1"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                    />
                                    <button
                                        onClick={tab === "login" ? onLoginPhoneConfirm : onSignupPhoneConfirm}
                                        className="px-3 py-2 rounded-xl border hover:bg-gray-50"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 mt-3">Use Firebase test numbers on free plan.</p>
                        </div>
                    </div>

                    {!!message && (
                        <div className="mt-4 rounded-xl p-3 bg-green-50 border border-green-200 text-green-700">{message}</div>
                    )}
                    {!!lastError && (
                        <pre className="mt-3 text-xs p-2 bg-red-50 border border-red-200 text-red-700 rounded-xl overflow-x-auto">
{JSON.stringify(lastError, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </Layout>
    );
}

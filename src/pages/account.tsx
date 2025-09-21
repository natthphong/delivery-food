import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@components/Layout";
import axios, { type ApiResponse } from "@utils/apiClient";
import { auth, makeRecaptcha } from "@utils/firebaseClient";
import { useAppDispatch } from "@store/index";
import { logout, setUser } from "@store/authSlice";
import { signInWithPhoneNumber, signOut } from "firebase/auth";
import { clearTokens, clearUser, saveUser } from "@utils/tokenStorage";
import { useRouter } from "next/router";
import ProfileCard from "@/components/account/ProfileCard";
import VerifyUpdateCard from "@/components/account/VerifyUpdateCard";
import type { Me } from "@/components/account/types";
import type { I18nKey } from "@/constants/i18nKeys";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";

import type { ConfirmationResult } from "firebase/auth";

type AccountUpdatePayload = {
    email?: string | null;
    phone?: string | null;
    is_email_verified?: boolean | null;
    is_phone_verified?: boolean | null;
};

type UserEnvelope = { user?: any };

type AccountUpdateResponse = ApiResponse<UserEnvelope>;
type SendVerifyEmailResponse = ApiResponse<{ ok: boolean }>;

type MessageState = { key: I18nKey } | { text: string } | null;

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

const emptyUser = normalizeUser(null);

export default function AccountPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<MessageState>(null);
    const [error, setError] = useState<MessageState>(null);

    const [newEmail, setNewEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");

    const [updatingEmail, setUpdatingEmail] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [confirmingOtp, setConfirmingOtp] = useState(false);

    const confirmRef = useRef<ConfirmationResult | null>(null);

    const resolvedMessage = useMemo(() => {
        if (!message) return "";
        return "key" in message ? t(message.key) : message.text;
    }, [message, t]);

    const resolvedError = useMemo(() => {
        if (!error) return "";
        return "key" in error ? t(error.key) : error.text;
    }, [error, t]);

    const fetchMe = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get<ApiResponse<UserEnvelope>>("/api/user/me");
            if (r.data.code !== "OK") {
                throw new Error(r.data.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR));
            }
            const user = r.data.body?.user;
            if (!user) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
            }
            setMe(normalizeUser(user));
            dispatch(setUser(user));
            saveUser(user);
            setError(null);
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_LOAD_ERROR);
            setError({ text: messageText });
            setMe(null);
        } finally {
            setLoading(false);
        }
    }, [dispatch, t]);

    useEffect(() => {
        fetchMe().catch(() => {});
    }, [fetchMe]);

    async function updateAccount(patch: AccountUpdatePayload) {
        const response = await axios.post<AccountUpdateResponse>("/api/v1/account/update", patch);
        if (response.data.code !== "OK") {
            throw new Error(response.data.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_FAILED));
        }
        const user = response.data.body?.user;
        if (!user) {
            throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_INVALID_PROFILE));
        }
        setMe(normalizeUser(user));
        dispatch(setUser(user));
        saveUser(user);
    }

    async function handleVerifyEmail() {
        setError(null);
        setMessage(null);
        try {
            if (!auth.currentUser) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
            }
            setVerifyingEmail(true);
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                await updateAccount({ is_email_verified: true });
                setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_VERIFIED });
            } else {
                const idToken = await auth.currentUser.getIdToken();
                const response = await axios.post<SendVerifyEmailResponse>("/api/user/send-verify-email", { idToken });
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || t(I18N_KEYS.ACCOUNT_ERROR_VERIFY_EMAIL));
                }
                setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_VERIFICATION_SENT });
            }
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_PROCESS_EMAIL);
            setError({ text: messageText });
        } finally {
            setVerifyingEmail(false);
        }
    }

    async function handleChangeEmail() {
        setError(null);
        setMessage(null);
        try {
            const trimmed = newEmail.trim();
            if (!trimmed) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NEW_EMAIL_REQUIRED));
            }
            if (!auth.currentUser) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_SESSION));
            }
            setUpdatingEmail(true);
            await updateAccount({ email: trimmed });
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_EMAIL_UPDATED });
            setNewEmail("");
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_UPDATE_EMAIL);
            setError({ text: messageText });
        } finally {
            setUpdatingEmail(false);
        }
    }

    async function handleSendOtp() {
        setError(null);
        setMessage(null);
        try {
            const trimmed = phone.trim();
            if (!trimmed) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_PHONE_REQUIRED));
            }
            setSendingOtp(true);
            const verifier = makeRecaptcha("btn-send-otp");
            const confirmation = await signInWithPhoneNumber(auth, trimmed, verifier);
            confirmRef.current = confirmation;
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_OTP_SENT });
            setOtp("");
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.code || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_SEND_OTP);
            setError({ text: messageText });
        } finally {
            setSendingOtp(false);
        }
    }

    async function handleConfirmOtp() {
        setError(null);
        setMessage(null);
        try {
            const confirmation = confirmRef.current;
            if (!confirmation) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_NO_OTP_SESSION));
            }
            const code = otp.trim();
            if (!code) {
                throw new Error(t(I18N_KEYS.ACCOUNT_ERROR_ENTER_OTP));
            }
            setConfirmingOtp(true);
            await confirmation.confirm(code);
            const trimmedPhone = phone.trim();
            await updateAccount({ phone: trimmedPhone || null, is_phone_verified: true });
            setMessage({ key: I18N_KEYS.ACCOUNT_MESSAGE_PHONE_VERIFIED });
            setPhone("");
            setOtp("");
            confirmRef.current = null;
        } catch (e: any) {
            const messageText = e?.response?.data?.message || e?.code || e?.message || t(I18N_KEYS.ACCOUNT_ERROR_CONFIRM_OTP);
            setError({ text: messageText });
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

    const safeUser = me ?? emptyUser;

    return (
        <Layout>
            <div className="mx-auto max-w-2xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">{t(I18N_KEYS.ACCOUNT_TITLE)}</h1>
                    <p className="text-sm text-slate-500">{t(I18N_KEYS.ACCOUNT_SUBTITLE)}</p>
                </div>

                <ProfileCard me={safeUser} loading={loading} onLogout={handleLogout} />

                <VerifyUpdateCard
                    me={me}
                    newEmail={newEmail}
                    setNewEmail={setNewEmail}
                    onResendEmail={handleVerifyEmail}
                    onChangeEmail={handleChangeEmail}
                    phone={phone}
                    setPhone={setPhone}
                    otp={otp}
                    setOtp={setOtp}
                    onSendOtp={handleSendOtp}
                    onConfirmOtp={handleConfirmOtp}
                    verifyingEmail={verifyingEmail}
                    updatingEmail={updatingEmail}
                    sendingOtp={sendingOtp}
                    confirmingOtp={confirmingOtp}
                />

                {!!resolvedMessage && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {resolvedMessage}
                    </div>
                )}
                {!!resolvedError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{resolvedError}</div>
                )}
            </div>
        </Layout>
    );
}

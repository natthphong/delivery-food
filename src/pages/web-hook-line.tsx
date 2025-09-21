// src/pages/web-hook-line.tsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "@components/Layout";
import { useRouter } from "next/router";
import axios from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import { setTokens, setUser } from "@store/authSlice";
import { saveTokens, saveUser } from "@utils/tokenStorage";
import liff from "@line/liff";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

type Status = "boot" | "init" | "login" | "post" | "done" | "error";

export default function WebHookLinePage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();

    const [status, setStatus] = useState<Status>("boot");
    const [err, setErr] = useState<string>("");

    useEffect(() => {
        if (!router.isReady) return;

        let cancelled = false;

        const run = async () => {
            try {
                await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID as string });
                setStatus("init");
                if (!liff.isLoggedIn()) {
                    setStatus("login");
                    liff.login();
                }
                const profile = await liff.getProfile();
                if (!profile) {
                    throw new Error(t(I18N_KEYS.LINE_ERROR_NO_PROFILE));
                }
                setStatus("post");
                const r = await axios.post("/api/login-line", { profile });
                if (cancelled) return;
                const tokens = {
                    accessToken: r.data?.body?.accessToken,
                    refreshToken: r.data?.body?.refreshToken,
                };
                if (!tokens.accessToken || !tokens.refreshToken) {
                    throw new Error(t(I18N_KEYS.LINE_ERROR_NO_TOKENS));
                }
                const user = r.data?.body?.user;
                dispatch(setTokens(tokens));
                dispatch(setUser(user));
                saveTokens(tokens);
                saveUser(user);
                setStatus("done");
                router.replace("/");
            } catch (e: any) {

                if (cancelled) return;
                const fallback = t(I18N_KEYS.LINE_ERROR_DEFAULT);
                const message = typeof e?.message === "string" && e.message.length > 0 ? e.message : fallback;
                setErr(message);
                setStatus("error");
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [router.isReady, router.query.next, dispatch, router, t]);

    return (
        <Layout>
            <Head>
                <title>{t(I18N_KEYS.LINE_PAGE_TITLE)}</title>
                <meta name="robots" content="noindex" />
            </Head>

            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-full max-w-md text-center bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-sm">
                    {status !== "error" ? (
                        <>
                            <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-emerald-300 border-t-transparent animate-spin" />
                            <h1 className="text-xl font-semibold mb-1">{t(I18N_KEYS.LINE_PAGE_TITLE)}</h1>
                            <p className="text-slate-500 text-sm">
                                {status === "boot" && t(I18N_KEYS.LINE_STATUS_BOOT)}
                                {status === "init" && t(I18N_KEYS.LINE_STATUS_INIT)}
                                {status === "login" && t(I18N_KEYS.LINE_STATUS_LOGIN)}
                                {status === "post" && t(I18N_KEYS.LINE_STATUS_POST)}
                                {status === "done" && t(I18N_KEYS.LINE_STATUS_DONE)}
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-xl font-semibold text-rose-600 mb-2">{t(I18N_KEYS.LINE_ERROR_TITLE)}</h1>
                            <p className="text-sm text-slate-600">{err}</p>
                            <button
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                                onClick={() => router.replace("/login")}
                            >
                                {t(I18N_KEYS.LINE_BACK_TO_LOGIN)}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}

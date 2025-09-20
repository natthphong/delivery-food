// src/pages/web-hook-line.tsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "@components/Layout";
import { useRouter } from "next/router";
import axios from "@utils/apiClient";
import { useAppDispatch } from "@store/index";
import { setTokens } from "@store/authSlice";
import { saveTokens } from "@utils/tokenStorage";
import liff from "@line/liff";

type Status = "boot" | "init" | "login" | "post" | "done" | "error";

export default function WebHookLinePage() {
    const router = useRouter();
    const dispatch = useAppDispatch();

    const [status, setStatus] = useState<Status>("boot");
    const [err, setErr] = useState<string>("");

    useEffect(() => {
        if (!router.isReady) return;

        let cancelled = false;

        const run = async () => {
            try {
                setStatus("init");

                await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID as string });
                if (!liff.isLoggedIn()) {
                    setStatus("login");
                    liff.login();
                }

                const idToken = liff.getIDToken();
                if (!idToken) {
                    throw new Error(
                        "LINE returned no idToken. Enable OpenID Connect and add 'openid profile' (and 'email' if needed) scopes in your LINE Login channel."
                    );
                }
                setStatus("post");
                const r = await axios.post("/api/login-line", { idToken });
                if (cancelled) return;
                const tokens = {
                    accessToken: r.data?.body?.accessToken,
                    refreshToken: r.data?.body?.refreshToken,
                };
                if (!tokens.accessToken || !tokens.refreshToken) {
                    throw new Error("Server did not return tokens");
                }
                dispatch(setTokens(tokens));
                saveTokens(tokens);
                setStatus("done");
                router.replace("/");
            } catch (e: any) {
                if (cancelled) return;
                setErr(e?.message || "LINE callback error");
                setStatus("error");
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [router.isReady, router.query.next, dispatch, router]);

    return (
        <Layout>
            <Head>
                <title>Processing LINE sign-in…</title>
                <meta name="robots" content="noindex" />
            </Head>

            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-full max-w-md text-center bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-6 shadow-sm">
                    {status !== "error" ? (
                        <>
                            <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-emerald-300 border-t-transparent animate-spin" />
                            <h1 className="text-xl font-semibold mb-1">Processing LINE sign-in…</h1>
                            <p className="text-slate-500 text-sm">
                                {status === "boot" && "Booting…"}
                                {status === "init" && "Initializing LIFF"}
                                {status === "login" && "Redirecting to LINE Login"}
                                {status === "post" && "Finalizing session"}
                                {status === "done" && "Done"}
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-xl font-semibold text-rose-600 mb-2">LINE login error</h1>
                            <p className="text-sm text-slate-600">{err}</p>
                            <button
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                                onClick={() => router.replace("/login")}
                            >
                                Back to Login
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}

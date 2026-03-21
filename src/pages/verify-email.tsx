import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/authSlice";
import { verifyEmailToken } from "@/services/app";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export default function VerifyEmailPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

    const token = useMemo(() => {
        const raw = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token;
        return typeof raw === "string" ? raw : "";
    }, [router.query.token]);

    useEffect(() => {
        if (!router.isReady) return;
        if (!token) {
            setStatus("error");
            return;
        }
        verifyEmailToken(token)
            .then((payload) => {
                dispatch(setUser(payload.user));
                setStatus(payload.verified ? "success" : "error");
            })
            .catch(() => {
                setStatus("error");
            });
    }, [dispatch, router.isReady, token]);

    const toneClass = status === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : status === "error"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-slate-700";

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-4 py-12">
            <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-3xl font-semibold text-slate-950">{t(I18N_KEYS.VERIFY_EMAIL_TITLE)}</h1>
                <p className="mt-3 text-sm text-slate-500">{t(I18N_KEYS.VERIFY_EMAIL_SUBTITLE)}</p>
                <div className={`mt-6 rounded-3xl border px-5 py-4 text-sm ${toneClass}`}>
                    {status === "processing"
                        ? t(I18N_KEYS.VERIFY_EMAIL_PROCESSING)
                        : status === "success"
                            ? t(I18N_KEYS.VERIFY_EMAIL_SUCCESS)
                            : t(I18N_KEYS.VERIFY_EMAIL_ERROR)}
                </div>
                <Link
                    href="/login"
                    className="mt-6 inline-flex rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                    {t(I18N_KEYS.VERIFY_EMAIL_LOGIN)}
                </Link>
            </div>
        </div>
    );
}

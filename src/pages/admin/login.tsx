import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAppDispatch, useAppSelector } from "@/store";
import { setAdminSession, setAdminTokens } from "@/store/adminAuthSlice";
import { adminLogin } from "@/services/adminAuth";
import { notify } from "@/utils/notify";
import { saveAdminSession, saveAdminTokens } from "@/utils/tokenStorage";
import { adminButtonPrimaryClass, adminInputClass } from "@/components/admin/ui";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

export default function AdminLoginPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const session = useAppSelector((state) => state.adminAuth.session);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (session) {
            void router.replace("/admin");
        }
    }, [router, session]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSubmitting(true);
            const payload = await adminLogin({ username, password });
            dispatch(setAdminTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }));
            dispatch(setAdminSession(payload.session));
            saveAdminTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
            saveAdminSession(payload.session);
            notify(t(I18N_KEYS.ADMIN_LOGIN_SUCCESS), "success");
            await router.replace("/admin");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || t(I18N_KEYS.ADMIN_LOGIN_ERROR), "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] px-4 py-10">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-[2.5rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,#ffffff_0%,#d1fae5_130%)] px-8 py-10 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">{t(I18N_KEYS.ADMIN_LOGIN_EYEBROW)}</p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">{t(I18N_KEYS.ADMIN_LOGIN_TITLE)}</h1>
                    <p className="mt-4 max-w-2xl text-base text-slate-600">
                        {t(I18N_KEYS.ADMIN_LOGIN_SUBTITLE)}
                    </p>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.75rem] border border-white bg-white/80 p-4">
                            <p className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.ADMIN_LOGIN_SCOPE_TITLE)}</p>
                            <p className="mt-2 text-sm text-slate-600">{t(I18N_KEYS.ADMIN_LOGIN_SCOPE_BODY)}</p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white bg-white/80 p-4">
                            <p className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.ADMIN_LOGIN_ACCESS_TITLE)}</p>
                            <p className="mt-2 text-sm text-slate-600">{t(I18N_KEYS.ADMIN_LOGIN_ACCESS_BODY)}</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t(I18N_KEYS.ADMIN_LOGIN_FORM_EYEBROW)}</p>
                    <h2 className="mt-3 text-3xl font-semibold text-slate-950">{t(I18N_KEYS.ADMIN_LOGIN_FORM_TITLE)}</h2>
                    <p className="mt-2 text-sm text-slate-500">{t(I18N_KEYS.ADMIN_LOGIN_FORM_SUBTITLE)}</p>

                    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_LOGIN_USERNAME)}</span>
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="owner"
                                className={adminInputClass}
                            />
                        </label>
                        <label className="block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_LOGIN_PASSWORD)}</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="••••••••"
                                className={adminInputClass}
                            />
                        </label>
                        <button type="submit" disabled={submitting} className={`${adminButtonPrimaryClass} w-full`}>
                            {submitting ? t(I18N_KEYS.ADMIN_LOGIN_SUBMITTING) : t(I18N_KEYS.ADMIN_LOGIN_SUBMIT)}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAppDispatch, useAppSelector } from "@/store";
import { setAdminSession, setAdminTokens } from "@/store/adminAuthSlice";
import { adminLogin } from "@/services/adminAuth";
import { notify } from "@/utils/notify";
import { saveAdminSession, saveAdminTokens } from "@/utils/tokenStorage";
import { adminButtonPrimaryClass, adminInputClass } from "@/components/admin/ui";

export default function AdminLoginPage() {
    const router = useRouter();
    const dispatch = useAppDispatch();
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
            notify("Admin session ready.", "success");
            await router.replace("/admin");
        } catch (error: any) {
            notify(error?.response?.data?.message || error?.message || "Unable to sign in to admin mode.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ecfdf5_100%)] px-4 py-10">
            <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-[2.5rem] bg-[linear-gradient(135deg,#052e2b_0%,#0f766e_52%,#d1fae5_130%)] px-8 py-10 text-white shadow-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">Owner and staff</p>
                    <h1 className="mt-5 text-4xl font-semibold tracking-tight">Run branches, teams, payroll, and delivery from one control room.</h1>
                    <p className="mt-4 max-w-2xl text-base text-emerald-50/85">
                        Admin mode is backed by the Go API and PostgreSQL operations schema. Use your bootstrap owner credentials or a staff account created from employee management.
                    </p>
                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4">
                            <p className="text-sm font-semibold">Operations scope</p>
                            <p className="mt-2 text-sm text-emerald-50/85">Employees, attendance, payroll, branches, orders, riders, and payment observability.</p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4">
                            <p className="text-sm font-semibold">Access model</p>
                            <p className="mt-2 text-sm text-emerald-50/85">Role-aware sessions, branch scope, and backend-enforced permissions.</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Admin sign in</p>
                    <h2 className="mt-3 text-3xl font-semibold text-slate-950">Management console</h2>
                    <p className="mt-2 text-sm text-slate-500">Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` or a staff account provisioned in employee management.</p>

                    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Username</span>
                            <input
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="owner"
                                className={adminInputClass}
                            />
                        </label>
                        <label className="block space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Password</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="••••••••"
                                className={adminInputClass}
                            />
                        </label>
                        <button type="submit" disabled={submitting} className={`${adminButtonPrimaryClass} w-full`}>
                            {submitting ? "Signing in..." : "Enter admin mode"}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
}

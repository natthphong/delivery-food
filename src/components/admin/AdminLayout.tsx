import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { useAppDispatch, useAppSelector } from "@/store";
import { adminLogout } from "@/store/adminAuthSlice";
import { clearAdminSession, clearAdminTokens } from "@/utils/tokenStorage";
import { hasAnyAdminPermission } from "@/components/admin/permissions";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS, type I18nKey } from "@/constants/i18nKeys";

type NavItem = {
    href: string;
    labelKey: I18nKey;
    permissions: string[];
};

const NAV_ITEMS: NavItem[] = [
    { href: "/admin", labelKey: I18N_KEYS.ADMIN_NAV_OVERVIEW, permissions: ["dashboard.read"] },
    { href: "/admin/employees", labelKey: I18N_KEYS.ADMIN_NAV_EMPLOYEES, permissions: ["employees.read", "employees.manage"] },
    { href: "/admin/attendance", labelKey: I18N_KEYS.ADMIN_NAV_ATTENDANCE, permissions: ["attendance.read", "attendance.manage", "attendance.self"] },
    { href: "/admin/payroll", labelKey: I18N_KEYS.ADMIN_NAV_PAYROLL, permissions: ["payroll.read", "payroll.manage", "ot.self", "ot.review"] },
    { href: "/admin/branches", labelKey: I18N_KEYS.ADMIN_NAV_BRANCHES, permissions: ["branches.read", "branches.manage", "stock.read", "stock.manage"] },
    { href: "/admin/orders", labelKey: I18N_KEYS.ADMIN_NAV_ORDERS, permissions: ["orders.read", "orders.manage"] },
    { href: "/admin/riders", labelKey: I18N_KEYS.ADMIN_NAV_RIDERS, permissions: ["rider.jobs.read", "rider.jobs.claim", "orders.manage"] },
    { href: "/admin/payments", labelKey: I18N_KEYS.ADMIN_NAV_PAYMENTS, permissions: ["payments.read", "payments.manage"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const session = useAppSelector((state) => state.adminAuth.session);

    const navItems = useMemo(
        () => NAV_ITEMS.filter((item) => hasAnyAdminPermission(session, item.permissions)),
        [session]
    );

    const handleLogout = async () => {
        dispatch(adminLogout());
        clearAdminTokens();
        clearAdminSession();
        await router.replace("/admin/login");
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_30%),linear-gradient(180deg,#f8fffb_0%,#f3f4f6_100%)]">
            <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
                <aside className="border-b border-slate-200 bg-white/90 px-4 py-5 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r lg:px-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t(I18N_KEYS.ADMIN_MODE)}</p>
                            <h1 className="mt-2 text-xl font-semibold text-slate-950">{t(I18N_KEYS.ADMIN_CONSOLE_TITLE)}</h1>
                            <p className="mt-2 text-sm text-slate-500">{session?.actorLabel || t(I18N_KEYS.ADMIN_CONSOLE_FALLBACK)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                        >
                            {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                        </button>
                    </div>

                    <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4 text-slate-900">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_ROLES)}</p>
                        <p className="mt-2 text-sm font-medium">{session?.roles.join(", ") || "-"}</p>
                        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_BRANCHES)}</p>
                        <p className="mt-2 text-sm font-medium">
                            {session?.branchIds?.length ? `${session.branchIds.length}` : t(I18N_KEYS.ADMIN_ALL_BRANCHES)}
                        </p>
                    </div>

                    <nav className="mt-5 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                        {navItems.map((item) => {
                            const active = router.pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`inline-flex min-w-max items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                                        active
                                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                                            : "bg-white text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    {t(item.labelKey)}
                                </Link>
                            );
                        })}
                    </nav>
                </aside>

                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
}

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { useAppDispatch, useAppSelector } from "@/store";
import { adminLogout } from "@/store/adminAuthSlice";
import { clearAdminSession, clearAdminTokens } from "@/utils/tokenStorage";
import { hasAnyAdminPermission } from "@/components/admin/permissions";
import { type Locale, useI18n } from "@/utils/i18n";
import { I18N_KEYS, type I18nKey } from "@/constants/i18nKeys";

type NavItem = {
    href: string;
    labelKey: I18nKey;
    groupKey: string;
    permissions: string[];
};

const NAV_ITEMS: NavItem[] = [
    { href: "/admin", labelKey: I18N_KEYS.ADMIN_NAV_OVERVIEW, groupKey: "admin.navGroup.operations", permissions: ["dashboard.read"] },
    { href: "/admin/orders", labelKey: I18N_KEYS.ADMIN_NAV_ORDERS, groupKey: "admin.navGroup.operations", permissions: ["orders.read", "orders.manage"] },
    { href: "/admin/branches", labelKey: I18N_KEYS.ADMIN_NAV_BRANCHES, groupKey: "admin.navGroup.operations", permissions: ["branches.read", "branches.manage", "stock.read", "stock.manage"] },
    { href: "/admin/riders", labelKey: I18N_KEYS.ADMIN_NAV_RIDERS, groupKey: "admin.navGroup.operations", permissions: ["rider.jobs.read", "rider.jobs.claim", "orders.manage"] },
    { href: "/admin/employees", labelKey: I18N_KEYS.ADMIN_NAV_EMPLOYEES, groupKey: "admin.navGroup.people", permissions: ["employees.read", "employees.manage"] },
    { href: "/admin/attendance", labelKey: I18N_KEYS.ADMIN_NAV_ATTENDANCE, groupKey: "admin.navGroup.people", permissions: ["attendance.read", "attendance.manage", "attendance.self"] },
    { href: "/admin/payroll", labelKey: I18N_KEYS.ADMIN_NAV_PAYROLL, groupKey: "admin.navGroup.finance", permissions: ["payroll.read", "payroll.manage", "ot.self", "ot.review"] },
    { href: "/admin/payments", labelKey: I18N_KEYS.ADMIN_NAV_PAYMENTS, groupKey: "admin.navGroup.finance", permissions: ["payments.read", "payments.manage"] },
];

function LocaleSwitcher() {
    const router = useRouter();
    const { locale, setLocale, t } = useI18n();

    const handleChange = (nextLocale: Locale) => {
        if (nextLocale === locale) return;
        setLocale(nextLocale);
        void router.replace(
            {
                pathname: router.pathname,
                query: { ...router.query, lang: nextLocale },
            },
            undefined,
            { shallow: true }
        );
    };

    return (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.LOCALE_SWITCHER_LABEL)}</p>
            <div className="mt-3 flex items-center gap-2">
                {(["th", "en"] as Locale[]).map((option) => {
                    const active = option === locale;
                    return (
                        <button
                            key={option}
                            type="button"
                            onClick={() => handleChange(option)}
                            className={`min-w-[3.25rem] rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                                active ? "bg-emerald-500 text-slate-950" : "bg-slate-100 text-slate-600 hover:bg-emerald-50"
                            }`}
                            aria-pressed={active}
                        >
                            {option.toUpperCase()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const session = useAppSelector((state) => state.adminAuth.session);

    const navSections = useMemo(() => {
        const visibleItems = NAV_ITEMS.filter((item) => hasAnyAdminPermission(session, item.permissions));
        const grouped = new Map<string, NavItem[]>();
        visibleItems.forEach((item) => {
            const current = grouped.get(item.groupKey) ?? [];
            current.push(item);
            grouped.set(item.groupKey, current);
        });
        return Array.from(grouped.entries()).map(([groupKey, items]) => ({ groupKey, items }));
    }, [session]);

    const handleLogout = async () => {
        dispatch(adminLogout());
        clearAdminTokens();
        clearAdminSession();
        await router.replace("/admin/login");
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,#fbfefc_0%,#f8fafc_100%)]">
            <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col lg:flex-row">
                <aside className="border-b border-slate-200 bg-white/95 px-4 py-5 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[22rem] lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:px-6">
                    <div className="shrink-0">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t(I18N_KEYS.ADMIN_MODE)}</p>
                                <h1 className="mt-2 text-xl font-semibold text-slate-950">{t(I18N_KEYS.ADMIN_CONSOLE_TITLE)}</h1>
                                <p className="mt-2 text-sm text-slate-500">{session?.actorLabel || t(I18N_KEYS.ADMIN_CONSOLE_FALLBACK)}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_BRANCHES)}</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                    {session?.branchIds?.length ? `${session.branchIds.length}` : t(I18N_KEYS.ADMIN_ALL_BRANCHES)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-4 text-slate-900">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t(I18N_KEYS.ADMIN_ROLES)}</p>
                            <p className="mt-2 text-sm font-medium leading-6">{session?.roles.join(", ") || "-"}</p>
                        </div>
                    </div>

                    <div className="mt-6 min-h-0 flex-1 overflow-hidden">
                        <nav
                            data-testid="admin-sidebar-scroll"
                            className="flex h-full flex-col gap-5 overflow-x-auto pb-2 lg:overflow-y-auto lg:overflow-x-hidden lg:pr-2"
                        >
                            {navSections.map((section) => (
                                <div key={section.groupKey} className="min-w-max lg:min-w-0">
                                    <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        {t(section.groupKey as any)}
                                    </p>
                                    <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                                        {section.items.map((item) => {
                                            const active = router.pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`inline-flex min-w-max items-center rounded-2xl px-4 py-3 text-sm font-medium transition lg:min-w-0 lg:whitespace-normal ${
                                                        active
                                                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                                                            : "bg-white text-slate-600 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    {t(item.labelKey)}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-5 shrink-0 space-y-3 border-t border-slate-100 pt-4">
                        <LocaleSwitcher />
                        <button
                            type="button"
                            onClick={() => void handleLogout()}
                            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                            {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                        </button>
                    </div>
                </aside>

                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
}

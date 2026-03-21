import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import { formatTHB } from "@/utils/currency";
import { useAppDispatch, type RootState } from "@/store";
import { logoutCustomer } from "@/utils/logout";

const MENU_TRANSITION_CLASSES = "transition hover:bg-slate-100";

const Navbar: React.FC = () => {
    const { t } = useI18n();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const user = useSelector((state: RootState) => state.auth.user);
    const adminSession = useSelector((state: RootState) => state.adminAuth.session);
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const balanceValue = typeof user?.walletBalance === "number" ? user.walletBalance : 0;
    const formattedBalance = formatTHB(balanceValue);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        function handleEsc(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, []);

    const handleNavigate = (href: string) => {
        setOpen(false);
        router.push(href);
    };

    const handleLogout = async () => {
        setOpen(false);
        await logoutCustomer(dispatch, router);
    };

    return (
        <nav className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex items-center gap-3">
                    <Link href="/" className="text-lg font-semibold text-emerald-700">
                        {t(I18N_KEYS.BRAND_NAME)}
                    </Link>
                    <div className="hidden items-center gap-2 md:flex">
                        <Link href="/" className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            {t(I18N_KEYS.NAV_HOME)}
                        </Link>
                        <Link href="/account?tab=orders" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            {t(I18N_KEYS.NAV_ACCOUNT_ORDERS)}
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-700">
                    {user && (
                        <span
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                            {formattedBalance}
                        </span>
                    )}
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:ring-offset-2"
                            aria-haspopup="menu"
                            aria-expanded={open}
                        >
                            <span>{t(I18N_KEYS.NAV_ACCOUNT)}</span>
                            <svg
                                className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <path
                                    d="M5 7.5L10 12.5L15 7.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                        {open && (
                            <div
                                className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        const ev = new CustomEvent("open-deposit-modal");
                                        window.dispatchEvent(ev);
                                    }}
                                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                >
                                    {t(I18N_KEYS.DEPOSIT_ACTION)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNavigate("/account?tab=profile")}
                                    className={`${MENU_TRANSITION_CLASSES} mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700`}
                                >
                                    {t(I18N_KEYS.NAV_ACCOUNT_DETAILS)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNavigate("/account?tab=orders")}
                                    className={`${MENU_TRANSITION_CLASSES} mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700`}
                                >
                                    {t(I18N_KEYS.NAV_ACCOUNT_ORDERS)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleNavigate("/account?tab=transactions")}
                                    className={`${MENU_TRANSITION_CLASSES} mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700`}
                                >
                                    {t(I18N_KEYS.NAV_ACCOUNT_TRANSACTIONS)}
                                </button>
                                {adminSession ? (
                                    <button
                                        type="button"
                                        onClick={() => handleNavigate("/admin")}
                                        className={`${MENU_TRANSITION_CLASSES} mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700`}
                                    >
                                        {t(I18N_KEYS.ADMIN_ENTRY)}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => void handleLogout()}
                                    className="mt-1 w-full rounded-xl bg-emerald-500 px-3 py-2 text-left text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
                                >
                                    {t(I18N_KEYS.ACCOUNT_LOGOUT)}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

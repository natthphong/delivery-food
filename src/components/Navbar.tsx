import Link from "next/link";
import { useSelector } from "react-redux";
import LocaleSwitcher from "@/components/i18n/LocaleSwitcher";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import { formatTHB } from "@/utils/currency";
import type { RootState } from "@/store";

const Navbar: React.FC = () => {
    const { t } = useI18n();
    const user = useSelector((state: RootState) => state.auth.user);

    const balanceValue = typeof user?.balance === "number" ? user.balance : 0;
    const formattedBalance = formatTHB(balanceValue);

    return (
        <nav className="border-b bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="text-lg font-semibold text-emerald-600">
                    {t(I18N_KEYS.BRAND_NAME)}
                </Link>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                    {user && (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                            {formattedBalance}
                        </span>
                    )}
                    <LocaleSwitcher />
                    <Link href="/account" className="rounded-lg px-3 py-2 transition hover:bg-slate-100">
                        {t(I18N_KEYS.NAV_ACCOUNT)}
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

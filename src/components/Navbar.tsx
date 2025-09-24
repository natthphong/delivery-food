import Link from "next/link";
import { useSelector } from "react-redux";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import type { RootState } from "@/store";
import BalanceDropdown from "@/components/layout/BalanceDropdown";

const Navbar: React.FC = () => {
    const { t } = useI18n();
    const user = useSelector((state: RootState) => state.auth.user);

    return (
        <nav className="border-b bg-white">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="text-lg font-semibold text-emerald-600">
                    {t(I18N_KEYS.BRAND_NAME)}
                </Link>
                <div className="flex items-center gap-3 text-sm text-slate-700">

                    <Link href="/account" className="rounded-lg px-3 py-2 transition hover:bg-slate-100">
                        {t(I18N_KEYS.NAV_ACCOUNT)}
                    </Link>

                    {user ? <BalanceDropdown /> : null}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

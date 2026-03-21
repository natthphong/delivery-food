import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./Navbar";
import FloatingCartButton from "@components/cart/FloatingCartButton";
import CartDrawer from "@components/cart/CartDrawer";
import NotificationCenter from "@components/notifications/NotificationCenter";
import { FloatingLanguageToggle } from "@components/common";
import { useAppSelector } from "@/store";
import DepositModal from "@/components/payment/DepositModal";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartOpen, setCartOpen] = useState(false);
    const [depositOpen, setDepositOpen] = useState(false);
    const cart = useAppSelector((state) => state.cart.value);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = () => setDepositOpen(true);
        window.addEventListener("open-deposit-modal", handler);
        return () => {
            window.removeEventListener("open-deposit-modal", handler);
        };
    }, []);

    const { branchId: defaultBranchId, companyId: defaultCompanyId } = useMemo(() => {
        const parseNumeric = (value: unknown): number | null => {
            if (typeof value === "number" && Number.isFinite(value)) {
                return value;
            }
            if (typeof value === "string" && value.trim()) {
                const num = Number(value);
                return Number.isFinite(num) ? num : null;
            }
            return null;
        };

        const groups = cart.groups ?? [];
        const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;
        const branchId = parseNumeric(lastGroup?.branchId) ?? 1;
        const companyId = parseNumeric(lastGroup?.companyId) ?? 1;
        return { branchId, companyId };
    }, [cart.groups]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.1),_transparent_28%),linear-gradient(180deg,#f7fdf9_0%,#ffffff_45%,#f0fdf4_100%)]">
            <Navbar />
            <NotificationCenter />
            <main className="px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
            <FloatingLanguageToggle />
            <FloatingCartButton onClick={() => setCartOpen(true)} />
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
            <DepositModal
                open={depositOpen}
                onClose={() => setDepositOpen(false)}
                defaultBranchId={defaultBranchId}
                defaultCompanyId={defaultCompanyId}
            />
        </div>
    );
};

export default Layout;

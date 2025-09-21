import React, { useState } from "react";
import Navbar from "./Navbar";
import FloatingCartButton from "@components/cart/FloatingCartButton";
import CartDrawer from "@components/cart/CartDrawer";
import NotificationCenter from "@components/notifications/NotificationCenter";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cartOpen, setCartOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <NotificationCenter />
            <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
            <FloatingCartButton onClick={() => setCartOpen(true)} />
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        </div>
    );
};

export default Layout;

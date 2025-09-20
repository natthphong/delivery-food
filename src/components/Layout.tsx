import React from "react";
import Navbar from "./Navbar";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
);

export default Layout;

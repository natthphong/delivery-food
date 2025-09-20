import React from "react";

export type AuthTab = "login" | "signup";

export type AuthTabsProps = {
    value: AuthTab;
    onChange: (next: AuthTab) => void;
};

const AuthTabs: React.FC<AuthTabsProps> = ({ value, onChange }) => {
    return (
        <div className="flex rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Authentication mode">
            {(["login", "signup"] as AuthTab[]).map((tab) => {
                const active = value === tab;
                return (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        role="tab"
                        aria-selected={active}
                        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            active
                                ? "bg-white shadow-sm border border-slate-200 text-slate-900"
                                : "border border-transparent text-slate-600 hover:bg-white/60"
                        }`}
                    >
                        {tab === "login" ? "Login" : "Signup"}
                    </button>
                );
            })}
        </div>
    );
};

export default AuthTabs;

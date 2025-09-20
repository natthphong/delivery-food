import React from "react";

export type LoaderOverlayProps = {
    show: boolean;
    label?: string;
};

export const LoaderOverlay: React.FC<LoaderOverlayProps> = ({ show, label }) => {
    if (!show) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-white/70 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-6 py-5 shadow-sm">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/40 border-t-transparent" aria-hidden />
                {label && <p className="text-sm font-medium text-emerald-700">{label}</p>}
            </div>
        </div>
    );
};

export default LoaderOverlay;

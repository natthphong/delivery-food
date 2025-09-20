import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg";

export type ModalProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: ModalSize;
};

const sizeClasses: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    return Array.from(container.querySelectorAll<HTMLElement>(selectors));
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = "md" }) => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const lastActiveRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open || typeof document === "undefined") return;

        lastActiveRef.current = document.activeElement as HTMLElement;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "Tab" && contentRef.current) {
                const focusable = getFocusableElements(contentRef.current);
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey) {
                    if (document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    }
                } else if (document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        const timer = setTimeout(() => {
            const focusable = contentRef.current ? getFocusableElements(contentRef.current) : [];
            if (focusable.length > 0) {
                focusable[0].focus();
            } else {
                contentRef.current?.focus();
            }
        }, 20);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("keydown", handleKeyDown);
            lastActiveRef.current?.focus();
        };
    }, [open, onClose]);

    if (!open || typeof window === "undefined") return null;

    const modalContent = (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6" role="presentation">
            <div
                className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
                aria-hidden="true"
                onClick={onClose}
            />
            <div
                ref={contentRef}
                className={`${sizeClasses[size]} relative z-[71] w-full rounded-3xl border border-slate-200 bg-white shadow-lg outline-none focus:outline-none`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div>{title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}</div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-slate-700">{children}</div>
                {footer && <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div>}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;

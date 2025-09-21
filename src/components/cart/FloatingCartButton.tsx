import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import { totalItemCount } from "@utils/cart";

type FloatingCartButtonProps = {
    onClick: () => void;
};

export default function FloatingCartButton({ onClick }: FloatingCartButtonProps) {
    const card = useSelector((state: RootState) => state.auth.user?.card ?? []);
    const hasUser = useSelector((state: RootState) => !!state.auth.user);

    const count = useMemo(() => totalItemCount(card), [card]);

    if (!hasUser) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.98]"
            aria-label="Open cart"
        >
            <span className="relative inline-flex items-center justify-center">
                <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                >
                    <path
                        d="M3.5 5h1.89c.45 0 .84.3.95.73l.44 1.77M7 12h10.74a1 1 0 0 0 .98-.8l1-4.8A1 1 0 0 0 18.76 5H6.78"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span className="absolute -top-2 -right-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-600 shadow-sm">
                    {count}
                </span>
            </span>
            <span className="hidden sm:inline">Basket</span>
        </button>
    );
}

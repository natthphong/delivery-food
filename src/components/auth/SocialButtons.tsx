import React from "react";

export type SocialButtonsProps = {
    mode: "login" | "signup";
    onGoogle: () => Promise<void> | void;
    onLine: () => Promise<void> | void;
    submitting: boolean;
};

const SocialButtons: React.FC<SocialButtonsProps> = ({ mode, onGoogle, onLine, submitting }) => {
    const handleGoogle = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!submitting) {
            void onGoogle();
        }
    };

    const handleLine = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (!submitting) {
            void onLine();
        }
    };

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={handleLine}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                <img src="/line-icon.svg" alt="LINE" className="h-4 w-4" />
                <span>Continue with LINE</span>
            </button>
            <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
                <svg viewBox="0 0 533.5 544.3" className="h-4 w-4" aria-hidden>
                    <path
                        d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.4h146.9c-6.3 34.3-25.2 63.3-53.7 82.7v68h86.9c50.8-46.8 80.4-116 80.4-195.7z"
                        fill="#4285F4"
                    />
                    <path
                        d="M272 544.3c72.9 0 134.2-24.1 178.9-65.6l-86.9-68c-24.1 16.2-55 25.9-92 25.9-70.7 0-130.7-47.7-152.1-111.8H30.7v70.2C75.1 486.3 167.8 544.3 272 544.3z"
                        fill="#34A853"
                    />
                    <path
                        d="M119.9 325c-10.1-30.3-10.1-63.3 0-93.6V161.2H30.7c-41.3 82.6-41.3 179.3 0 261.9l89.2-70.2z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M272 107.7c39.6-.6 77.4 14.8 106.4 42.7l79.7-79.7C404.4 24.3 343.4-.1 272 0 167.8 0 75.1 58 30.7 161.2l89.2 70.2C141.3 155.3 201.3 107.7 272 107.7z"
                        fill="#EA4335"
                    />
                </svg>
                <span>Continue with Google</span>
            </button>
            <p className="text-[11px] text-slate-500">
                Quick sign {mode === "login" ? "in" : "up"} with providers.
            </p>
        </div>
    );
};

export default SocialButtons;

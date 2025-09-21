import React from "react";

type QuantityInputProps = {
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
};

const QuantityInput: React.FC<QuantityInputProps> = ({ value, min = 1, max = 99, onChange }) => {
    const clamp = (next: number) => {
        const bounded = Math.min(Math.max(next, min), max);
        onChange(bounded);
    };

    const decrease = () => {
        if (value <= min) return;
        clamp(value - 1);
    };

    const increase = () => {
        if (value >= max) return;
        clamp(value + 1);
    };

    return (
        <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
                type="button"
                onClick={decrease}
                disabled={value <= min}
                className="h-10 w-10 select-none text-lg font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                -
            </button>
            <span className="min-w-[48px] text-center text-sm font-semibold text-slate-900">{value}</span>
            <button
                type="button"
                onClick={increase}
                disabled={value >= max}
                className="h-10 w-10 select-none text-lg font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                +
            </button>
        </div>
    );
};

export default QuantityInput;

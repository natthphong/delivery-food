export default function AdminStatCard({
    label,
    value,
    tone = "emerald",
    hint,
}: {
    label: string;
    value: string | number;
    tone?: "emerald" | "slate" | "amber" | "rose";
    hint?: string;
}) {
    const tones = {
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        slate: "bg-slate-100 text-slate-700 border-slate-200",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        rose: "bg-rose-50 text-rose-700 border-rose-100",
    };

    return (
        <div className={`rounded-[1.5rem] border p-4 shadow-sm ${tones[tone]}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
            {hint ? <p className="mt-2 text-sm opacity-85">{hint}</p> : null}
        </div>
    );
}

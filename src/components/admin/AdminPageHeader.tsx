export default function AdminPageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow: string;
    title: string;
    description: string;
    actions?: React.ReactNode;
}) {
    return (
        <header className="rounded-[2rem] border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_40%),linear-gradient(180deg,#ffffff_0%,#f0fdf4_100%)] px-6 py-7 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">{eyebrow}</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </header>
    );
}

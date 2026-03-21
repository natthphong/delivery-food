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
        <header className="rounded-[2rem] bg-[linear-gradient(135deg,#052e2b_0%,#0f766e_50%,#d1fae5_130%)] px-6 py-7 text-white shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-100">{eyebrow}</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
                    <p className="mt-2 max-w-3xl text-sm text-emerald-50/85">{description}</p>
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
        </header>
    );
}

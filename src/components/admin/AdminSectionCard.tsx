export default function AdminSectionCard({
    title,
    description,
    children,
    actions,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

export function formatAdminDate(value?: string | null) {
    if (!value) return "-";
    try {
        return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
        return value;
    }
}

export function formatAdminDateOnly(value?: string | null) {
    if (!value) return "-";
    try {
        return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
    } catch {
        return value;
    }
}

export function formatMinutesLabel(minutes: number) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours <= 0) {
        return `${remainder}m`;
    }
    if (remainder <= 0) {
        return `${hours}h`;
    }
    return `${hours}h ${remainder}m`;
}

export function statusTone(status: string) {
    const normalized = status.toLowerCase();
    if (["accepted", "prepare", "completed", "delivered", "open", "active", "approved"].includes(normalized)) {
        return "bg-emerald-50 text-emerald-700";
    }
    if (["pending", "waiting_for_rider", "assigned_to_rider"].includes(normalized)) {
        return "bg-amber-50 text-amber-700";
    }
    if (["rejected", "failed_delivery", "cancelled", "inactive", "closed"].includes(normalized)) {
        return "bg-rose-50 text-rose-700";
    }
    return "bg-slate-100 text-slate-700";
}

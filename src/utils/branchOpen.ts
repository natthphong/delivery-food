import { DateTime } from "luxon";

function pad(t: string) {
    if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
}

export function isBranchOpen({
    isForceClosed,
    openHours,
    now = DateTime.now().setZone("Asia/Bangkok"),
}: {
    isForceClosed: boolean;
    openHours: any;
    now?: DateTime;
}): boolean {
    if (isForceClosed) return false;
    if (!openHours || typeof openHours !== "object") return true;

    const localDow = now.weekday === 7 ? 6 : now.weekday - 1;
    const key = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][localDow];
    const spans: any[] = Array.isArray(openHours[key]) ? openHours[key] : [];

    if (!spans.length) return true;
    const current = now.toFormat("HH:mm:ss");

    for (const span of spans) {
        if (!Array.isArray(span) || span.length !== 2) continue;
        const o = pad(String(span[0] ?? ""));
        const c = pad(String(span[1] ?? ""));
        if (!/^\d{2}:\d{2}:\d{2}$/.test(o) || !/^\d{2}:\d{2}:\d{2}$/.test(c)) continue;

        if (c > o) {
            if (current >= o && current < c) return true;
        } else {
            if (current >= o || current < c) return true;
        }
    }
    return false;
}

export default isBranchOpen;

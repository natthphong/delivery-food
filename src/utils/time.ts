// src/utils/time.ts

// Returns epoch ms for a DB timestamp string assumed to be UTC if it lacks offset.
// Accepts: "2025-09-24 07:50:13.134000" | "2025-09-24T07:50:13.134Z" | "...+00:00"
export function dbUtcToEpochMs(ts: string | null | undefined): number | null {
    if (!ts) return null;
    let s = String(ts).trim();

    // Normalize space separator to 'T'
    if (s.includes(" ") && !s.includes("T")) s = s.replace(" ", "T");

    // Strip trailing microseconds to millis
    // e.g. 2025-09-24T07:50:13.134000 -> 2025-09-24T07:50:13.134
    s = s.replace(/(\.\d{3})\d+$/, "$1");

    // If no 'Z' or timezone offset present, assume UTC and append Z
    const hasOffset = /Z$|[+\-]\d{2}:?\d{2}$/.test(s);
    if (!hasOffset) s = `${s}Z`;

    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
}

export function isExpiredUTC(ts: string | null | undefined, nowMs = Date.now()): boolean {
    const ms = dbUtcToEpochMs(ts);
    if (ms == null) return false;
    return nowMs >= ms;
}

// Convert any Date/string to ISO in Asia/Bangkok (+07:00) without extra libs.
export function toBangkokIso(input: string | number | Date | null | undefined): string | null {
    if (!input) return null;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    // Asia/Bangkok is fixed UTC+7 (no DST)
    const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return bkk.toISOString().replace("Z", "+07:00");
}

// Helper to map common timestamp fields on a row (mutates a shallow copy).
export function mapTimestampsToBangkok<T extends Record<string, any>>(row: T, fields: string[]): T {
    const out = { ...row } as T;
    for (const f of fields) {
        if (f in out) {
            out[f] = toBangkokIso(out[f]) as any;
        }
    }
    return out;
}

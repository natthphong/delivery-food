// src/utils/time.ts
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

export function toBangkokIso(input: string | Date | null | undefined): string | null {
    if (!input) {
        return null;
    }

    const date = typeof input === "string" ? new Date(input) : new Date(input);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const utcMs = date.getTime();
    const bangkokOffsetMs = 7 * 60 * 60 * 1000;
    const shifted = new Date(utcMs + bangkokOffsetMs);
    const iso = shifted.toISOString().replace(/Z$/, "+07:00");
    return iso;
}

export function isExpiredUTC(ts: string | null | undefined): boolean {
    if (!ts) {
        return false;
    }

    let normalized = String(ts).trim();
    if (!normalized) {
        return false;
    }

    if (normalized.includes(" ") && !normalized.includes("T")) {
        normalized = normalized.replace(" ", "T");
    }

    normalized = normalized.replace(/(\.\d{3})\d+$/, "$1");
    if (!/Z$|[+\-]\d{2}:?\d{2}$/.test(normalized)) {
        normalized = `${normalized}Z`;
    }

    const parsed = Date.parse(normalized);
    if (Number.isNaN(parsed)) {
        return false;
    }

    return Date.now() >= parsed;
}

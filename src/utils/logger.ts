// src/utils/logger.ts
type LogObj = Record<string, unknown>;

function ts() {
    return new Date().toISOString();
}

export function logInfo(msg: string, obj?: LogObj) {
    console.log(`[INFO] ${ts()} ${msg}`, obj ? safe(obj) : "");
}

export function logError(msg: string, obj?: LogObj) {
    console.error(`[ERROR] ${ts()} ${msg}`, obj ? safe(obj) : "");
}

function safe(o: LogObj) {
    try {
        const s = JSON.stringify(o, (_k, v) => {
            if (typeof v === "string") {
                if (/^eyJ/.test(v) && v.length > 20) return "[REDACTED_JWT]";
                if (/secret|password|apikey/i.test(v)) return "[REDACTED]";
            }
            return v;
        });
        return JSON.parse(s);
    } catch {
        return o;
    }
}

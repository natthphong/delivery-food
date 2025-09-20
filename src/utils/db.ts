// src/utils/db.ts
import { Pool, PoolConfig } from "pg";

function bool(v: any, def = false) {
    if (v === undefined || v === null || v === "") return def;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
}

function getEnv(name: string, fallback?: string) {
    return process.env[name] ?? fallback;
}

/**
 * We support several env shapes (in order):
 * 1) DATABASE_URL                         (server-only preferred)
 * 2) NEXT_PUBLIC_DB_URL                   (your current var; less secure)
 * 3) Individual fields:
 *    DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *    (or NEXT_PUBLIC_DB_HOST / ... as fallback)
 */
function buildPgConfig(): PoolConfig {
    const connectionString =
        getEnv("DATABASE_URL") ||
        getEnv("NEXT_PUBLIC_DB_URL");

    if (connectionString && /^postgres/i.test(connectionString)) {
        return {
            connectionString,
            ssl: bool(getEnv("DB_SSL", "false"))
                ? { rejectUnauthorized: false }
                : undefined,
            max: Number(getEnv("DB_POOL_MAX", "5")),
        };
    }

    // Individual fields
    const host =
        getEnv("DB_HOST") || getEnv("NEXT_PUBLIC_DB_HOST") || "localhost";
    const port = Number(getEnv("DB_PORT") || getEnv("NEXT_PUBLIC_DB_PORT") || "5432");
    const user =
        getEnv("DB_USER") || getEnv("NEXT_PUBLIC_DB_USERNAME") || "postgres";
    const password =
        getEnv("DB_PASSWORD") || getEnv("NEXT_PUBLIC_DB_PASSWORD") || "";
    const database =
        getEnv("DB_NAME") || getEnv("NEXT_PUBLIC_DB_NAME") || "postgres";

    // Guard against placeholders like "base" etc.
    if (host === "base" || database === "base" || user === "base") {
        // This is a common copy/paste placeholder — fail fast with a helpful message
        throw new Error(
            `Invalid DB envs: looks like a placeholder value is set (host/user/db equals "base"). ` +
            `Please set real values (e.g. DB_HOST=localhost, DB_NAME=yourdb, ...).`
        );
    }

    return {
        host,
        port,
        user,
        password,
        database,
        ssl: bool(getEnv("DB_SSL", "false"))
            ? { rejectUnauthorized: false }
            : undefined,
        max: Number(getEnv("DB_POOL_MAX", "5")),
    };
}

const cfg = buildPgConfig();

// Light logging (no secrets)
console.log("[db] Using Postgres config", {
    mode: cfg["connectionString"] ? "connectionString" : "fields",
    host: (cfg as any).host || "via-connectionString",
    port: (cfg as any).port || "via-connectionString",
    database: (cfg as any).database || "via-connectionString",
    ssl: !!cfg.ssl,
    max: cfg.max,
});

export const db = new Pool(cfg);

// Helpful event logs
db.on("error", (err) => {
    console.error("[db] Pool error", err);
});

export async function assertDb() {
    const client = await db.connect();
    try {
        await client.query("select 1");
    } finally {
        client.release();
    }
}

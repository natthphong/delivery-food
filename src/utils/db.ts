// src/utils/db.ts
import { sql as vercelSql } from "@vercel/postgres";

type EnvMapping = [primary: string, fallback: string];

const envFallbacks: EnvMapping[] = [
    ["POSTGRES_URL", "NEXT_PUBLIC_DELIVERY_POSTGRES_URL"],
    ["POSTGRES_URL_NON_POOLING", "NEXT_PUBLIC_DELIVERY_POSTGRES_URL_NON_POOLING"],
    ["POSTGRES_PRISMA_URL", "NEXT_PUBLIC_DELIVERY_POSTGRES_PRISMA_URL"],
    ["POSTGRES_USER", "NEXT_PUBLIC_DELIVERY_POSTGRES_USER"],
    ["POSTGRES_HOST", "NEXT_PUBLIC_DELIVERY_POSTGRES_HOST"],
    ["POSTGRES_PASSWORD", "NEXT_PUBLIC_DELIVERY_POSTGRES_PASSWORD"],
    ["POSTGRES_DATABASE", "NEXT_PUBLIC_DELIVERY_POSTGRES_DATABASE"],
];

for (const [primary, fallback] of envFallbacks) {
    if (!process.env[primary] && process.env[fallback]) {
        process.env[primary] = process.env[fallback];
    }
}

export const sql = vercelSql;

let searchPathPromise: Promise<void> | null = null;

async function ensureSearchPath() {
    if (searchPathPromise) return searchPathPromise;

    searchPathPromise = (async () => {
        try {
            await sql`SET search_path TO delivery_app, public`;
        } catch (error: any) {
            const message = error?.message || "unknown";
            console.warn(`[db] Failed to set search_path: ${message}`);
        }
    })();

    return searchPathPromise;
}

if (typeof window === "undefined") {
    void ensureSearchPath();
}

export async function ensureSchema() {
    if (process.env.NODE_ENV === "production") return;
    try {
        await sql`CREATE SCHEMA IF NOT EXISTS delivery_app`;
    } catch (error: any) {
        const message = error?.message || "unknown";
        console.warn(`[db] Failed to ensure schema: ${message}`);
    }
    await ensureSearchPath();
}

export { ensureSearchPath };

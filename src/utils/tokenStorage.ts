// src/utils/tokenStorage.ts
import type { UserRecord } from "@/types";

export type StoredTokens = { accessToken: string; refreshToken: string };
const KEY = "auth_tokens_v1";
const USER_KEY = "APP_USER";

export function saveTokens(tokens: StoredTokens) {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function loadTokens(): StoredTokens | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredTokens;
    } catch {
        return null;
    }
}

export function clearTokens() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEY);
}

export function saveUser(user: UserRecord) {
    if (typeof window === "undefined") return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): UserRecord | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as UserRecord;
        return parsed;
    } catch {
        return null;
    }
}

export function clearUser() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(USER_KEY);
}

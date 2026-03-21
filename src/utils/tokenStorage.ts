// src/utils/tokenStorage.ts
import type { Cart, UserRecord } from "@/types";

export type StoredTokens = { accessToken: string; refreshToken: string };
const KEY = "auth_tokens_v1";
const USER_KEY = "APP_USER";
const CONFIG_KEY = "APP_CONFIG";
const CART_KEY = "APP_CART";

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

export function saveConfig(config: Record<string, string>) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadConfig(): Record<string, string> | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

export function clearConfig() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CONFIG_KEY);
}

export function saveCart(cart: Cart) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function loadCart(): Cart | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as Cart;
    } catch {
        return null;
    }
}

export function clearCart() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CART_KEY);
}

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    clearConfig,
    clearTokens,
    clearUser,
    loadConfig,
    loadTokens,
    loadUser,
    saveConfig,
    saveTokens,
    saveUser,
    type StoredTokens,
} from "../src/utils/tokenStorage";
import type { UserRecord } from "../src/types";

class MemoryStorage implements Storage {
    private store = new Map<string, string>();

    get length(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }

    getItem(key: string): string | null {
        return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number): string | null {
        return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }
}

describe("tokenStorage utilities", () => {
    const tokens: StoredTokens = { accessToken: "access", refreshToken: "refresh" };
    const user: UserRecord = {
        id: 1,
        firebase_uid: "uid",
        email: "user@example.com",
        phone: null,
        provider: "password",
        is_email_verified: true,
        is_phone_verified: false,
        balance: 125.5,
        txn_history: [],
        order_history: [],
        card: [],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
    };
    let storage: MemoryStorage;

    beforeEach(() => {
        storage = new MemoryStorage();
        (globalThis as any).localStorage = storage;
        (globalThis as any).window = { localStorage: storage };
    });

    afterEach(() => {
        delete (globalThis as any).window;
        delete (globalThis as any).localStorage;
    });

    it("saves and loads tokens", () => {
        saveTokens(tokens);
        assert.equal(storage.length, 1);
        assert.deepEqual(loadTokens(), tokens);
    });

    it("clears saved tokens", () => {
        saveTokens(tokens);
        clearTokens();
        assert.equal(storage.length, 0);
        assert.equal(loadTokens(), null);
    });

    it("returns null for malformed token payload", () => {
        storage.setItem("auth_tokens_v1", "not-json");
        assert.equal(loadTokens(), null);
    });

    it("stores and retrieves user payload", () => {
        saveUser(user);
        assert.deepEqual(loadUser(), user);
    });

    it("clears saved user", () => {
        saveUser(user);
        clearUser();
        assert.equal(loadUser(), null);
    });

    it("persists config maps", () => {
        const config = { MAX_QTY_PER_ITEM: "10", MAXIMUM_BRANCH_ORDER: "1" };
        saveConfig(config);
        assert.deepEqual(loadConfig(), config);
        clearConfig();
        assert.equal(loadConfig(), null);
    });

    it("is a no-op when window is undefined", () => {
        delete (globalThis as any).window;
        delete (globalThis as any).localStorage;
        saveTokens(tokens);
        assert.equal(loadTokens(), null);
    });
});

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { saveTokens, loadTokens, clearTokens } from "../src/utils/tokenStorage";

type Stored = { accessToken: string; refreshToken: string };
const KEY = "auth_tokens_v1";

class MemoryStorage {
    private store = new Map<string, string>();

    get length() {
        return this.store.size;
    }

    clear() {
        this.store.clear();
    }

    getItem(key: string) {
        return this.store.has(key) ? this.store.get(key)! : null;
    }

    key(index: number) {
        return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string) {
        this.store.delete(key);
    }

    setItem(key: string, value: string) {
        this.store.set(key, value);
    }
}

function installDom() {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", {
        value: storage,
        configurable: true,
        writable: false,
    });
    Object.defineProperty(globalThis, "window", {
        value: { localStorage: storage },
        configurable: true,
        writable: false,
    });
    return storage;
}

describe("tokenStorage", () => {
    let storage: MemoryStorage;

    beforeEach(() => {
        storage = installDom();
        storage.clear();
    });

    afterEach(() => {
        if ("window" in globalThis) {
            // @ts-ignore intentional cleanup
            delete (globalThis as any).window;
        }
        if ("localStorage" in globalThis) {
            // @ts-ignore intentional cleanup
            delete (globalThis as any).localStorage;
        }
    });

    test("saves and loads tokens", () => {
        const tokens: Stored = { accessToken: "a", refreshToken: "b" };
        saveTokens(tokens);
        assert.deepEqual(loadTokens(), tokens);
    });

    test("returns null when nothing stored", () => {
        assert.equal(loadTokens(), null);
    });

    test("returns null when stored JSON invalid", () => {
        storage.setItem(KEY, "{not-json}");
        assert.equal(loadTokens(), null);
    });

    test("clears stored tokens", () => {
        const tokens: Stored = { accessToken: "a", refreshToken: "b" };
        saveTokens(tokens);
        clearTokens();
        assert.equal(storage.getItem(KEY), null);
    });

    test("is no-op when window undefined", () => {
        const originalWindow = (globalThis as any).window;
        const originalStorage = (globalThis as any).localStorage;
        try {
            // @ts-ignore simulate server environment
            delete (globalThis as any).window;
            // @ts-ignore
            delete (globalThis as any).localStorage;
            const tokens: Stored = { accessToken: "a", refreshToken: "b" };
            assert.doesNotThrow(() => saveTokens(tokens));
            assert.equal(loadTokens(), null);
            assert.doesNotThrow(() => clearTokens());
        } finally {
            Object.defineProperty(globalThis, "localStorage", {
                value: originalStorage,
                configurable: true,
                writable: false,
            });
            Object.defineProperty(globalThis, "window", {
                value: originalWindow,
                configurable: true,
                writable: false,
            });
        }
    });
});

import {
    clearAdminSession,
    clearAdminTokens,
    clearTokens,
    loadAdminSession,
    loadAdminTokens,
    loadTokens,
    saveAdminSession,
    saveAdminTokens,
    saveTokens,
    type StoredTokens,
} from "@/utils/tokenStorage";
import type { AdminSession } from "@/types/admin";

describe("tokenStorage (jest)", () => {
    const tokens: StoredTokens = { accessToken: "access", refreshToken: "refresh" };
    const adminSession: AdminSession = {
        sessionType: "admin",
        actorType: "staff",
        actorLabel: "Store Owner",
        staffAccountId: 1,
        employeeId: 10,
        roles: ["owner"],
        permissions: ["dashboard.read"],
        branchIds: [1, 2],
    };

    beforeEach(() => {
        localStorage.clear();
    });

    it("saves and loads tokens in browser storage", () => {
        saveTokens(tokens);
        expect(loadTokens()).toEqual(tokens);
    });

    it("clears tokens from storage", () => {
        saveTokens(tokens);
        clearTokens();
        expect(loadTokens()).toBeNull();
    });

    it("saves and loads admin tokens and session", () => {
        saveAdminTokens(tokens);
        saveAdminSession(adminSession);
        expect(loadAdminTokens()).toEqual(tokens);
        expect(loadAdminSession()).toEqual(adminSession);
    });

    it("clears admin session state", () => {
        saveAdminTokens(tokens);
        saveAdminSession(adminSession);
        clearAdminTokens();
        clearAdminSession();
        expect(loadAdminTokens()).toBeNull();
        expect(loadAdminSession()).toBeNull();
    });
});

import { clearTokens, loadTokens, saveTokens, type StoredTokens } from "@/utils/tokenStorage";

describe("tokenStorage (jest)", () => {
    const tokens: StoredTokens = { accessToken: "access", refreshToken: "refresh" };

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
});

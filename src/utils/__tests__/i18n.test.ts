import {
    __resetLocaleForTests,
    getLocale,
    hydrateLocaleFromRuntime,
    resolveInitialLocale,
} from "@/utils/i18n";

describe("i18n locale initialization", () => {
    beforeEach(() => {
        window.localStorage.clear();
        __resetLocaleForTests();
        Object.defineProperty(window.navigator, "language", {
            configurable: true,
            value: "en-US",
        });
    });

    it("keeps the first render SSR-safe before applying stored locale preferences", () => {
        window.localStorage.setItem("app.lang", "th");

        expect(resolveInitialLocale()).toBe("en");
        expect(getLocale()).toBe("en");

        expect(hydrateLocaleFromRuntime()).toBe("th");
        expect(getLocale()).toBe("th");
    });

    it("honors the query locale consistently across the initial render and runtime hydration", () => {
        window.localStorage.setItem("app.lang", "en");
        Object.defineProperty(window.navigator, "language", {
            configurable: true,
            value: "th-TH",
        });

        expect(resolveInitialLocale("th")).toBe("th");
        expect(getLocale()).toBe("th");

        expect(hydrateLocaleFromRuntime("th")).toBe("th");
        expect(getLocale()).toBe("th");
    });
});

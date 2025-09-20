import { formatTHB } from "@utils/currency";

describe("formatTHB", () => {
    it("formats integer amounts", () => {
        expect(formatTHB(120)).toBe("฿120.00");
    });

    it("formats decimal amounts", () => {
        expect(formatTHB(120.5)).toBe("฿120.50");
    });

    it("returns dash for nullish values", () => {
        expect(formatTHB(null)).toBe("-");
        expect(formatTHB(undefined)).toBe("-");
        expect(formatTHB(Number.NaN)).toBe("-");
    });
});

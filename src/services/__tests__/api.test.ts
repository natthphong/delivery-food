import { unwrapResponse } from "@/services/api";

describe("unwrapResponse", () => {
    it("returns the envelope body for successful responses", () => {
        expect(
            unwrapResponse({
                code: "OK",
                message: "success",
                body: { id: 7, name: "Kaprao" },
            })
        ).toEqual({ id: 7, name: "Kaprao" });
    });

    it("throws the server message for non-OK responses", () => {
        expect(() =>
            unwrapResponse({
                code: "BAD_REQUEST",
                message: "branchId is required",
                body: null,
            })
        ).toThrow("branchId is required");
    });
});

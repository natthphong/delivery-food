import { __resetLocaleForTests } from "@/utils/i18n";
import { resolveUiError } from "@/utils/uiErrors";

describe("resolveUiError", () => {
    beforeEach(() => {
        __resetLocaleForTests();
    });

    it("maps known backend conflicts to friendly localized copy and field errors", () => {
        const parsed = resolveUiError(
            {
                response: {
                    status: 409,
                    data: {
                        code: "CONFLICT",
                        message: "email is already used",
                        body: null,
                    },
                },
            },
            { fallbackMessage: "Fallback message" }
        );

        expect(parsed.message).toBe("This email is already in use.");
        expect(parsed.fieldErrors).toEqual({
            email: "This email is already in use.",
        });
        expect(parsed.message).not.toBe("email is already used");
    });

    it("maps validation field errors into localized helper text", () => {
        const parsed = resolveUiError(
            {
                response: {
                    status: 422,
                    data: {
                        code: "VALIDATION_ERROR",
                        message: "validation failed",
                        body: {
                            fieldErrors: {
                                email: "must be valid email",
                                branchId: "select a source branch",
                            },
                        },
                    },
                },
            },
            { fallbackMessage: "Fallback message" }
        );

        expect(parsed.message).toBe("Please review the highlighted fields.");
        expect(parsed.fieldErrors).toEqual({
            email: "Enter a valid email address.",
            branchId: "Select a branch before continuing.",
        });
    });

    it("maps network failures without exposing transport text", () => {
        const parsed = resolveUiError(
            {
                message: "Network Error",
                code: "ERR_NETWORK",
            },
            { fallbackMessage: "Fallback message" }
        );

        expect(parsed.message).toBe("Unable to connect. Check your internet and try again.");
    });
});

import { resolveUiError } from "@/utils/uiErrors";

export type FieldErrors = Record<string, string>;

export type ParsedApiError = {
    code?: string;
    message: string;
    fieldErrors: FieldErrors;
};

export function parseApiError(error: any, fallbackMessage: string): ParsedApiError {
    const parsed = resolveUiError(error, { fallbackMessage });
    return {
        code: parsed.code,
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
    };
}

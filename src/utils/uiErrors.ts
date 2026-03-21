import { t } from "@/utils/i18n";

export type UiFieldErrors = Record<string, string>;

export type UiErrorResult = {
    code?: string;
    status?: number;
    backendMessage?: string;
    message: string;
    fieldErrors: UiFieldErrors;
};

type UiErrorOptions = {
    fallbackKey?: string;
    fallbackMessage?: string;
    codeMap?: Record<string, string>;
    messageMap?: Record<string, string>;
};

type FieldMapping = {
    field: string;
    key: string;
};

const CODE_KEY_MAP: Record<string, string> = {
    VALIDATION_ERROR: "common.errors.validationFailed",
    UNAUTHORIZED: "common.errors.sessionExpired",
    FORBIDDEN: "common.errors.accessDenied",
    NOT_FOUND: "common.errors.notFound",
    CONFLICT: "common.errors.conflict",
    BAD_REQUEST: "common.errors.validationFailed",
    INTERNAL_ERROR: "common.errors.generic",
};

const MESSAGE_KEY_MAP: Record<string, string> = {
    "email is already used": "common.errors.emailAlreadyUsed",
    "phone is already used": "common.errors.phoneAlreadyUsed",
    "invalid admin credentials": "common.errors.invalidCredentials",
    "refresh session is invalid": "common.errors.sessionExpired",
    "refresh session is expired": "common.errors.sessionExpired",
    "user session is invalid": "common.errors.sessionExpired",
    "missing bearer token": "common.errors.sessionExpired",
    "invalid access token": "common.errors.sessionExpired",
    "admin session is required": "common.errors.sessionExpired",
    "missing admin session": "common.errors.sessionExpired",
    "permission denied": "common.errors.accessDenied",
    "staff account is inactive": "common.errors.accountInactive",
    "product is not available in this branch": "common.errors.itemUnavailable",
    "product is no longer available": "common.errors.itemUnavailable",
    "one or more selected items are no longer available": "common.errors.cartChanged",
    "one or more selected cart items were not found": "common.errors.cartChanged",
    "selected cart items are no longer available": "common.errors.cartChanged",
    "selected cart items changed before checkout completed": "common.errors.cartChanged",
    "requested quantity exceeds stock": "common.errors.stockExceeded",
    "cart item quantity exceeds the configured maximum": "common.errors.cartLimit",
    "cart item not found": "common.errors.cartItemNotFound",
    "cart line limit reached": "common.errors.cartLimit",
    "branch is not accepting orders": "common.errors.branchUnavailable",
    "branch does not support pickup": "common.errors.branchUnavailable",
    "branch does not support rider delivery": "common.errors.branchUnavailable",
    "payment method not available": "common.errors.paymentMethodUnavailable",
    "wallet balance is insufficient": "common.errors.walletInsufficient",
    "transaction has expired": "common.errors.paymentExpired",
    "payment is still pending": "common.errors.paymentPending",
    "payment is already completed": "common.errors.paymentCompleted",
    "verification token is invalid or expired": "common.errors.verificationInvalid",
    "line login failed": "common.errors.lineLoginFailed",
};

const FIREBASE_CODE_KEY_MAP: Record<string, string> = {
    "auth/email-already-in-use": "common.errors.emailAlreadyUsed",
    "auth/invalid-email": "common.validation.invalidEmail",
    "auth/invalid-credential": "common.errors.invalidCredentials",
    "auth/invalid-login-credentials": "common.errors.invalidCredentials",
    "auth/user-not-found": "common.errors.invalidCredentials",
    "auth/wrong-password": "common.errors.invalidCredentials",
    "auth/user-disabled": "common.errors.accountInactive",
    "auth/too-many-requests": "common.errors.generic",
    "auth/network-request-failed": "common.errors.network",
    "auth/invalid-verification-code": "common.errors.otpFailed",
    "auth/code-expired": "common.errors.otpFailed",
};

const MESSAGE_FIELD_MAP: Record<string, FieldMapping> = {
    "email is already used": {
        field: "email",
        key: "common.errors.emailAlreadyUsed",
    },
    "phone is already used": {
        field: "phone",
        key: "common.errors.phoneAlreadyUsed",
    },
};

function translateKey(key?: string, fallbackMessage?: string): string {
    if (key) {
        return t(key as any);
    }
    if (fallbackMessage) {
        return fallbackMessage;
    }
    return t("common.errors.generic" as any);
}

function normalizeMessage(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function translateFieldError(message: string): string {
    const normalized = normalizeMessage(message);
    if (!normalized) {
        return t("common.validation.invalidField" as any);
    }
    if (normalized.includes("must be valid")) {
        return t("common.validation.invalidEmail" as any);
    }
    if (normalized.includes("is required") || normalized.includes("are required")) {
        return t("common.validation.required" as any);
    }
    if (normalized.includes("select at least one")) {
        return t("common.validation.selectAtLeastOne" as any);
    }
    if (normalized.includes("assign at least one branch")) {
        return t("common.validation.selectAtLeastOne" as any);
    }
    if (normalized.includes("must be greater than 0")) {
        return t("common.validation.mustBeGreaterThanZero" as any);
    }
    if (normalized.includes("cannot be negative")) {
        return t("common.validation.cannotBeNegative" as any);
    }
    if (normalized.includes("must be none, all, or selected")) {
        return t("common.validation.invalidChoice" as any);
    }
    if (normalized.includes("select a source branch")) {
        return t("common.validation.selectSourceBranch" as any);
    }
    if (normalized.includes("choose at least one category or menu item")) {
        return t("common.validation.chooseAtLeastOne" as any);
    }
    if (normalized.includes("cannot be 0")) {
        return t("common.validation.mustNotBeZero" as any);
    }
    if (normalized.includes("select a stock movement reason")) {
        return t("common.validation.selectReason" as any);
    }
    if (normalized.includes("must be rfc3339")) {
        return t("common.validation.invalidDateTime" as any);
    }
    if (normalized.includes("must be yyyy-mm-dd")) {
        return t("common.validation.invalidDate" as any);
    }
    return t("common.validation.invalidField" as any);
}

function mapFieldErrors(fieldErrors: unknown): UiFieldErrors {
    if (!fieldErrors || typeof fieldErrors !== "object") {
        return {};
    }
    return Object.fromEntries(
        Object.entries(fieldErrors as Record<string, string>).map(([field, message]) => [field, translateFieldError(message)])
    );
}

function isNetworkError(error: any) {
    return !error?.response && (error?.message === "Network Error" || error?.code === "ERR_NETWORK");
}

function isTimeoutError(error: any) {
    return error?.code === "ECONNABORTED" || normalizeMessage(error?.message).includes("timeout");
}

export function resolveUiError(error: any, options: UiErrorOptions = {}): UiErrorResult {
    const response = error?.response?.data;
    const code = typeof response?.code === "string" ? response.code : undefined;
    const status = typeof error?.response?.status === "number" ? error.response.status : undefined;
    const backendMessage = typeof response?.message === "string" ? response.message : undefined;
    const normalizedMessage = normalizeMessage(backendMessage || error?.message);
    const mappedFieldErrors = mapFieldErrors(response?.body?.fieldErrors);
    const knownFieldError = normalizedMessage ? MESSAGE_FIELD_MAP[normalizedMessage] : undefined;
    const fieldErrors = knownFieldError
        ? {
            ...mappedFieldErrors,
            [knownFieldError.field]: translateKey(knownFieldError.key),
        }
        : mappedFieldErrors;

    if (isTimeoutError(error)) {
        return {
            code,
            status,
            backendMessage,
            fieldErrors,
            message: translateKey("common.errors.timeout", options.fallbackMessage),
        };
    }

    if (isNetworkError(error)) {
        return {
            code,
            status,
            backendMessage,
            fieldErrors,
            message: translateKey("common.errors.network", options.fallbackMessage),
        };
    }

    const firebaseKey = typeof error?.code === "string" ? FIREBASE_CODE_KEY_MAP[error.code] : undefined;
    if (firebaseKey) {
        return {
            code,
            status,
            backendMessage,
            fieldErrors,
            message: translateKey(firebaseKey, options.fallbackMessage),
        };
    }

    const messageKey =
        options.messageMap?.[normalizedMessage] ||
        MESSAGE_KEY_MAP[normalizedMessage] ||
        (code ? options.codeMap?.[code] || CODE_KEY_MAP[code] : undefined);

    return {
        code,
        status,
        backendMessage,
        fieldErrors,
        message: translateKey(messageKey || options.fallbackKey, options.fallbackMessage),
    };
}

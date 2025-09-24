import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dictionary from "@/config/index.json";
import type { I18nKey } from "@/constants/i18nKeys";

export type Locale = "en" | "th";

type Dictionary = Record<I18nKey, Record<Locale, string>>;

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

const STORAGE_KEY = "app.lang";
const LEGACY_STORAGE_KEY = "locale";
const DEFAULT_LOCALE: Locale = "en";
const DICTIONARY = dictionary as Dictionary;

let cachedLocale: Locale | null = null;

function normalizeLocale(input: string | null | undefined): Locale | null {
    if (!input) return null;
    const value = input.toLowerCase();
    if (value.startsWith("th")) return "th";
    if (value.startsWith("en")) return "en";
    return null;
}

function updateDocumentLanguage(locale: Locale) {
    if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
    }
}

function resolveFromStorage(): Locale | null {
    if (typeof window === "undefined") return null;
    const storedPrimary = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    if (storedPrimary) {
        return storedPrimary;
    }
    const storedLegacy = normalizeLocale(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (storedLegacy) {
        return storedLegacy;
    }
    return null;
}

function resolveFromNavigator(): Locale {
    if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
        const normalized = normalizeLocale(navigator.language);
        if (normalized) {
            return normalized;
        }
    }
    return DEFAULT_LOCALE;
}

function getLangFromLocation(): string | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("lang");
}

function readLocaleParam(value: string | string[] | null | undefined): Locale | null {
    if (Array.isArray(value)) {
        return normalizeLocale(value[0]);
    }
    return normalizeLocale(value ?? undefined);
}

function persistLocale(locale: Locale) {
    cachedLocale = locale;
    if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, locale);
        window.localStorage.setItem(LEGACY_STORAGE_KEY, locale);
    }
    updateDocumentLanguage(locale);
}

function resolveLocale(queryValue?: string | string[]): Locale {
    const fromQuery = readLocaleParam(queryValue ?? getLangFromLocation());
    if (fromQuery) {
        if (cachedLocale === fromQuery) {
            return fromQuery;
        }
        persistLocale(fromQuery);
        return fromQuery;
    }

    if (cachedLocale) {
        return cachedLocale;
    }

    const storageLocale = resolveFromStorage();
    if (storageLocale) {
        persistLocale(storageLocale);
        return storageLocale;
    }

    const navigatorLocale = resolveFromNavigator();
    persistLocale(navigatorLocale);
    return navigatorLocale;
}

export function getLocale(): Locale {
    return resolveLocale();
}

export function setLocale(locale: Locale) {
    persistLocale(locale);
}

function interpolate(value: string, params?: TranslationParams): string {
    if (!params) {
        return value;
    }
    return value.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, token) => {
        const raw = params[token];
        if (raw === undefined || raw === null) {
            return match;
        }
        return String(raw);
    });
}

export function t(key: I18nKey, localeOverride?: Locale): string;
export function t(key: I18nKey, params: TranslationParams, localeOverride?: Locale): string;
export function t(
    key: I18nKey,
    paramsOrLocale?: TranslationParams | Locale,
    maybeLocale?: Locale
): string {
    let params: TranslationParams | undefined;
    let localeOverride: Locale | undefined;

    if (typeof paramsOrLocale === "string") {
        localeOverride = paramsOrLocale;
    } else if (paramsOrLocale && typeof paramsOrLocale === "object") {
        params = paramsOrLocale;
    }

    if (typeof maybeLocale === "string") {
        localeOverride = maybeLocale;
    }

    const locale = localeOverride ?? getLocale();
    const record = DICTIONARY[key];
    if (!record) {
        return key;
    }
    const value = record[locale];
    if (value && value.length > 0) {
        return interpolate(value, params);
    }
    const fallbackLocale: Locale = locale === "en" ? "th" : "en";
    const fallback = record[fallbackLocale];
    if (fallback && fallback.length > 0) {
        return interpolate(fallback, params);
    }
    return key;
}

export function useI18n() {
    const router = useRouter();
    const [locale, setLocaleState] = useState<Locale>(() => resolveLocale(router.query.lang));

    useEffect(() => {
        if (!router.isReady) return;
        const resolved = resolveLocale(router.query.lang);
        if (resolved !== locale) {
            setLocaleState(resolved);
        }
    }, [router.isReady, router.query.lang, locale]);

    const translate = useCallback(
        (key: I18nKey, params?: TranslationParams, override?: Locale) => t(key, params ?? undefined, override ?? locale),
        [locale]
    );

    const updateLocale = useCallback(
        (next: Locale) => {
            if (next === locale) return;
            persistLocale(next);
            setLocaleState(next);
        },
        [locale]
    );

    return useMemo(
        () => ({
            locale,
            t: translate,
            setLocale: updateLocale,
        }),
        [locale, translate, updateLocale]
    );
}

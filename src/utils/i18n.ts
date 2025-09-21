import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dictionary from "@/config/index.json";
import type { I18nKey } from "@/constants/i18nKeys";

export type Locale = "en" | "th";

type Dictionary = Record<I18nKey, Record<Locale, string>>;

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

function resolveFromQuery(): Locale | null {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const lang = normalizeLocale(params.get("lang"));
    if (!lang) return null;
    window.localStorage.setItem(STORAGE_KEY, lang);
    window.localStorage.setItem(LEGACY_STORAGE_KEY, lang);
    updateDocumentLanguage(lang);
    return lang;
}

function resolveFromStorage(): Locale | null {
    if (typeof window === "undefined") return null;
    const storedPrimary = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
    if (storedPrimary) {
        updateDocumentLanguage(storedPrimary);
        return storedPrimary;
    }
    const storedLegacy = normalizeLocale(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (storedLegacy) {
        window.localStorage.setItem(STORAGE_KEY, storedLegacy);
        updateDocumentLanguage(storedLegacy);
        return storedLegacy;
    }
    return null;
}

function resolveFromNavigator(): Locale {
    if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
        const normalized = normalizeLocale(navigator.language);
        if (normalized) {
            updateDocumentLanguage(normalized);
            return normalized;
        }
    }
    return DEFAULT_LOCALE;
}

function resolveLocale(): Locale {
    if (cachedLocale) return cachedLocale;
    const queryLocale = resolveFromQuery();
    if (queryLocale) {
        cachedLocale = queryLocale;
        return queryLocale;
    }
    const storageLocale = resolveFromStorage();
    if (storageLocale) {
        cachedLocale = storageLocale;
        return storageLocale;
    }
    const navigatorLocale = resolveFromNavigator();
    cachedLocale = navigatorLocale;
    return navigatorLocale;
}

export function getLocale(): Locale {
    if (cachedLocale) return cachedLocale;
    return resolveLocale();
}

export function setLocale(locale: Locale) {
    cachedLocale = locale;
    if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, locale);
        window.localStorage.setItem(LEGACY_STORAGE_KEY, locale);
    }
    updateDocumentLanguage(locale);
}

export function t(key: I18nKey, localeOverride?: Locale): string {
    const locale = localeOverride ?? getLocale();
    const record = DICTIONARY[key];
    if (!record) {
        return key;
    }
    const value = record[locale];
    if (value && value.length > 0) {
        return value;
    }
    const fallbackLocale: Locale = locale === "en" ? "th" : "en";
    const fallback = record[fallbackLocale];
    if (fallback && fallback.length > 0) {
        return fallback;
    }
    return key;
}

export function useI18n() {
    const router = useRouter();
    const [locale, setLocaleState] = useState<Locale>(() => getLocale());

    useEffect(() => {
        if (!router.isReady) return;
        const queryValue = router.query.lang;
        const nextFromQuery = Array.isArray(queryValue)
            ? normalizeLocale(queryValue[0])
            : normalizeLocale(queryValue ?? undefined);
        if (nextFromQuery && nextFromQuery !== locale) {
            setLocale(nextFromQuery);
            setLocaleState(nextFromQuery);
            return;
        }
        const current = resolveLocale();
        if (current !== locale) {
            setLocaleState(current);
        }
    }, [router.isReady, router.query.lang, locale]);

    const translate = useCallback(
        (key: I18nKey, override?: Locale) => t(key, override ?? locale),
        [locale]
    );

    const updateLocale = useCallback(
        (next: Locale) => {
            if (next === locale) return;
            setLocale(next);
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

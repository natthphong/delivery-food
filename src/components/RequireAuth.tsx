// src/components/RequireAuth.tsx
import { useEffect, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@store/index";
import { useRouter } from "next/router";
import axios, { type ApiResponse } from "@utils/apiClient";
import {
    clearTokens,
    clearUser,
    loadTokens,
    loadUser,
    saveTokens,
    saveUser,
    loadConfig,
    saveConfig,
    clearConfig as clearConfigStorage,
} from "@utils/tokenStorage";
import { setTokens, setUser } from "@store/authSlice";
import { setConfig, clearConfig as clearConfigState } from "@store/configSlice";
import { logError } from "@/utils/logger";

/**
 * RequireAuth
 * - Hydrates tokens/user/config from storage once
 * - Persists tokens/user/config changes back to storage
 * - Fetches config once when authenticated and not present
 * - Redirects to /login when unauthenticated (but not on /login)
 *
 * Critical fixes:
 * - Avoids infinite dispatch when accessToken is falsy by only clearing config if it actually has values
 * - Uses shallowEqual selector to reduce effect churn
 * - Guards duplicate config fetches with a ref
 * - Avoids redirect loop by skipping redirect on /login
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();

    const accessToken = useSelector((s: RootState) => s.auth.accessToken);
    const refreshToken = useSelector((s: RootState) => s.auth.refreshToken);
    const user = useSelector((s: RootState) => s.auth.user);
    const configValues = useSelector((s: RootState) => s.config.values, shallowEqual);

    const [hydrated, setHydrated] = useState(false);
    const [configHydrated, setConfigHydrated] = useState(false);

    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchingConfig = useRef(false);

    // 1) Initial hydration for auth (tokens/user) – run once
    useEffect(() => {
        // tokens
        const hasTokens = !!accessToken && !!refreshToken;
        if (!hasTokens) {
            const stored = loadTokens();
            if (stored?.accessToken && stored?.refreshToken) {
                dispatch(setTokens(stored));
            }
        }
        // user
        if (!user) {
            const storedUser = loadUser();
            if (storedUser) {
                dispatch(setUser(storedUser));
            }
        }
        setHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once

    // 2) Initial hydration for config – run after auth hydration once
    useEffect(() => {
        if (!hydrated || configHydrated) return;
        const storedConfig = loadConfig();
        if (storedConfig) {
            dispatch(setConfig(storedConfig));
        }
        setConfigHydrated(true);
    }, [hydrated, configHydrated, dispatch]);

    // 3) Persist tokens to storage when they change (after hydration)
    useEffect(() => {
        if (!hydrated) return;
        if (accessToken && refreshToken) {
            saveTokens({ accessToken, refreshToken });
        } else {
            clearTokens();
        }
    }, [accessToken, refreshToken, hydrated]);

    // 4) Persist/clear user in storage when it changes (after hydration)
    useEffect(() => {
        if (!hydrated) return;
        if (user) {
            saveUser(user);
        } else {
            clearUser();
        }
    }, [user, hydrated]);

    // 5) Config lifecycle:
    //    - If logged out: clear config only if it actually has values (prevents infinite loop)
    //    - If logged in & have values: persist
    //    - If logged in & empty: fetch once
    useEffect(() => {
        if (!hydrated || !configHydrated) return;

        // Logged out → clear only when there is something to clear
        if (!accessToken) {
            if (Object.keys(configValues).length > 0) {
                dispatch(clearConfigState());
                clearConfigStorage();
            }
            return;
        }

        // Logged in and already have config → persist & exit
        if (Object.keys(configValues).length > 0) {
            saveConfig(configValues);
            return;
        }

        // Logged in but no config → fetch once
        if (fetchingConfig.current) return;
        fetchingConfig.current = true;

        axios
            .get<ApiResponse<{ config: Record<string, string> }>>("/api/system/config")
            .then((response) => {
                if (response.data.code === "OK" && response.data.body?.config) {
                    dispatch(setConfig(response.data.body.config));
                    saveConfig(response.data.body.config);
                }
            })
            .catch((error) => {
                logError("RequireAuth: config fetch failed", { message: error?.message });
            })
            .finally(() => {
                fetchingConfig.current = false;
            });
    }, [accessToken, configValues, configHydrated, dispatch, hydrated]);

    // 6) Redirect unauthenticated users (but don't redirect on /login)
    useEffect(() => {
        if (!hydrated) return;
        if (accessToken) return;
        if (router.pathname === "/login") return;

        redirectTimer.current = setTimeout(() => {
            if (!accessToken && router.pathname !== "/login") {
                void router.replace("/login");
            }
        }, 50);

        return () => {
            if (redirectTimer.current) clearTimeout(redirectTimer.current);
        };
    }, [hydrated, accessToken, router.pathname, router]);

    // Gate rendering until hydrated & authenticated
    if (!hydrated) return null;
    if (!accessToken) return null;

    return <>{children}</>;
}

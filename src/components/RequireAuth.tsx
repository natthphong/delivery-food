// src/components/RequireAuth.tsx
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@store/index";
import { useRouter } from "next/router";
import axios, { type ApiResponse } from "@utils/apiClient";
import { clearTokens, clearUser, loadTokens, loadUser, saveTokens, saveUser, loadConfig, saveConfig, clearConfig as clearConfigStorage } from "@utils/tokenStorage";
import { setTokens, setUser } from "@store/authSlice";
import { setConfig, clearConfig as clearConfigState } from "@store/configSlice";
import { logError } from "@/utils/logger";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const accessToken = useSelector((s: RootState) => s.auth.accessToken);
    const refreshToken = useSelector((s: RootState) => s.auth.refreshToken);
    const user = useSelector((s: RootState) => s.auth.user);
    const configValues = useSelector((s: RootState) => s.config.values);
    const [hydrated, setHydrated] = useState(false);
    const [configHydrated, setConfigHydrated] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchingConfig = useRef(false);

    useEffect(() => {
        const hasTokens = !!accessToken && !!refreshToken;
        if (!hasTokens) {
            const stored = loadTokens();
            if (stored?.accessToken && stored?.refreshToken) {
                dispatch(setTokens(stored));
            }
        }
        if (!user) {
            const storedUser = loadUser();
            if (storedUser) {
                dispatch(setUser(storedUser));
            }
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated || configHydrated) return;
        const storedConfig = loadConfig();
        if (storedConfig) {
            dispatch(setConfig(storedConfig));
        }
        setConfigHydrated(true);
    }, [hydrated, configHydrated, dispatch]);

    useEffect(() => {
        if (!hydrated) return;
        if (accessToken && refreshToken) {
            saveTokens({ accessToken, refreshToken });
        } else {
            clearTokens();
        }
    }, [accessToken, refreshToken, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (user) {
            saveUser(user);
        } else {
            clearUser();
        }
    }, [user, hydrated]);

    useEffect(() => {
        if (!hydrated || !configHydrated) return;
        if (!accessToken) {
            dispatch(clearConfigState());
            clearConfigStorage();
            return;
        }
        if (Object.keys(configValues).length > 0) {
            saveConfig(configValues);
            return;
        }
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

    useEffect(() => {
        if (!hydrated) return;
        if (accessToken) return;
        redirectTimer.current = setTimeout(() => {
            if (!accessToken) router.replace("/login");
        }, 50);
        return () => {
            if (redirectTimer.current) clearTimeout(redirectTimer.current);
        };
    }, [hydrated, accessToken, router]);

    if (!hydrated) return null;
    if (!accessToken) return null;
    return <>{children}</>;
}

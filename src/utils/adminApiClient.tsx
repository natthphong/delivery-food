import Axios from "axios";
import Router from "next/router";
import { store } from "@/store";
import { adminLogout, setAdminSession, setAdminTokens } from "@/store/adminAuthSlice";
import { clearAdminSession, clearAdminTokens, saveAdminSession, saveAdminTokens } from "@/utils/tokenStorage";
import type { ApiResponse } from "@/utils/apiClient";
import type { AdminSession } from "@/types/admin";
import { notify } from "@/utils/notify";
import { t } from "@/utils/i18n";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const adminAxios = Axios.create({
    baseURL: API_BASE_URL,
    withCredentials: false,
});

let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];
let lastSessionExpiredNoticeAt = 0;

function flush(token: string | null) {
    queue.forEach((resolver) => resolver(token));
    queue = [];
}

function clearAdminState() {
    store.dispatch(adminLogout());
    clearAdminTokens();
    clearAdminSession();
}

function getRequestPath(config: any): string {
    const rawUrl = typeof config?.url === "string" ? config.url : "";
    if (!rawUrl) return "";
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        try {
            return new URL(rawUrl).pathname;
        } catch {
            return rawUrl;
        }
    }
    return rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
}

function isAdminAuthRequest(config: any) {
    const path = getRequestPath(config);
    return path === "/v1/admin/auth/login" || path === "/v1/admin/auth/refresh";
}

function notifySessionExpired() {
    const now = Date.now();
    if (now - lastSessionExpiredNoticeAt < 3000) {
        return;
    }
    lastSessionExpiredNoticeAt = now;
    notify(t("common.errors.sessionExpired" as any), "warning");
}

adminAxios.interceptors.request.use((config) => {
    const token = store.getState().adminAuth.accessToken;
    if (token) {
        config.headers = config.headers || {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
});

adminAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const { response, config } = error || {};
        const original = config;
        const status = response?.status;
        if (status === 401 && original && !original._retry && !isAdminAuthRequest(original)) {
            original._retry = true;
            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const refreshToken = store.getState().adminAuth.refreshToken;
                    if (!refreshToken) {
                        throw new Error("missing_refresh_token");
                    }
                    const refreshResponse = await Axios.post<ApiResponse<{ accessToken: string; refreshToken: string; session: AdminSession }>>(
                        `${API_BASE_URL}/v1/admin/auth/refresh`,
                        { refreshToken }
                    );
                    const payload = refreshResponse.data.body;
                    if (!payload?.accessToken || !payload?.refreshToken) {
                        throw new Error("invalid_refresh_response");
                    }
                    lastSessionExpiredNoticeAt = 0;
                    store.dispatch(setAdminTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken }));
                    if (payload.session) {
                        store.dispatch(setAdminSession(payload.session));
                        saveAdminSession(payload.session);
                    }
                    saveAdminTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
                    isRefreshing = false;
                    flush(payload.accessToken);
                    original.headers = {
                        ...(original.headers || {}),
                        Authorization: `Bearer ${payload.accessToken}`,
                    };
                    return adminAxios(original);
                } catch {
                    isRefreshing = false;
                    flush(null);
                    clearAdminState();
                    notifySessionExpired();
                    if (Router.pathname !== "/admin/login") {
                        void Router.replace("/admin/login");
                    }
                    return Promise.reject(error);
                }
            }

            return new Promise((resolve, reject) => {
                queue.push((token) => {
                    if (!token) {
                        clearAdminState();
                        if (Router.pathname !== "/admin/login") {
                            void Router.replace("/admin/login");
                        }
                        reject(error);
                        return;
                    }
                    original.headers = {
                        ...(original.headers || {}),
                        Authorization: `Bearer ${token}`,
                    };
                    resolve(adminAxios(original));
                });
            });
        }
        return Promise.reject(error);
    }
);

export default adminAxios;

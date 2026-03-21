// src/utils/apiClient.tsx
import Axios from "axios";
import Router from "next/router";
import { store } from "@/store";
import { setTokens, logout } from "@/store/authSlice";
import { clearCart, clearConfig, clearTokens, clearUser, saveTokens } from "@utils/tokenStorage";
import { clearCart as clearCartState } from "@/store/cartSlice";
import { clearConfig as clearConfigState } from "@/store/configSlice";
import { notify } from "@/utils/notify";
import { t } from "@/utils/i18n";

export type ApiResponse<T> = { code: string; message: string; body: T };
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const axios = Axios.create({
    baseURL: API_BASE_URL,
    withCredentials: false,
});

let isRefreshing = false;
let queue: Array<(t: string | null) => void> = [];
let lastSessionExpiredNoticeAt = 0;
const flush = (t: string | null) => {
    queue.forEach((fn) => fn(t));
    queue = [];
};

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

function isAuthRequest(config: any) {
    const path = getRequestPath(config);
    return path === "/v1/auth/login" || path === "/v1/auth/refresh";
}

function clearCustomerState() {
    store.dispatch(logout());
    store.dispatch(clearCartState());
    store.dispatch(clearConfigState());
    clearTokens();
    clearUser();
    clearCart();
    clearConfig();
}

function notifySessionExpired() {
    const now = Date.now();
    if (now - lastSessionExpiredNoticeAt < 3000) {
        return;
    }
    lastSessionExpiredNoticeAt = now;
    notify(t("common.errors.sessionExpired" as any), "warning");
}

axios.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
        config.headers = config.headers || {};
        (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
});

axios.interceptors.response.use(
    (res) => res,
    async (error) => {
        const { response, config } = error || {};
        const status = response?.status;
        const original = config;

        const isJwtError = status === 401;
        if (isJwtError && original && !original._retry && !isAuthRequest(original)) {
            original._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const rt = store.getState().auth.refreshToken;
                    if (!rt) throw new Error("no_refresh");
                    const r = await Axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(`${API_BASE_URL}/v1/auth/refresh`, {
                        refreshToken: rt,
                    });
                    const tokens = r.data?.body;
                    if (!tokens?.accessToken || !tokens?.refreshToken) {
                        throw new Error("Invalid refresh response");
                    }
                    lastSessionExpiredNoticeAt = 0;
                    store.dispatch(setTokens(tokens));
                    saveTokens(tokens);
                    isRefreshing = false;
                    flush(tokens.accessToken);
                    original.headers = {
                        ...(original.headers || {}),
                        Authorization: `Bearer ${tokens.accessToken}`,
                    };
                    return axios(original);
                } catch {
                    isRefreshing = false;
                    flush(null);
                    clearCustomerState();
                    notifySessionExpired();
                    if (Router.pathname !== "/login") {
                        void Router.replace("/login");
                    }
                    return Promise.reject(error);
                }
            }

            return new Promise((resolve, reject) => {
                queue.push((token) => {
                    if (!token) {
                        clearCustomerState();
                        if (Router.pathname !== "/login") {
                            void Router.replace("/login");
                        }
                        return reject(error);
                    }
                    original.headers = {
                        ...(original.headers || {}),
                        Authorization: `Bearer ${token}`,
                    };
                    resolve(axios(original));
                });
            });
        }

        return Promise.reject(error);
    }
);

export default axios;

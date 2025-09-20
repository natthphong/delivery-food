// src/utils/apiClient.tsx
import Axios from "axios";
import Router from "next/router";
import { store } from "@/store";
import { setTokens, logout } from "@/store/authSlice";
import { saveTokens } from "@utils/tokenStorage";
import liff from "@line/liff";

export type ApiResponse<T> = { code: string; message: string; body: T };

const axios = Axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
    withCredentials: false,
});

let isRefreshing = false;
let queue: Array<(t: string | null) => void> = [];
const flush = (t: string | null) => {
    queue.forEach((fn) => fn(t));
    queue = [];
};

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

        const isJwtError = status === 401 || status === 400;
        if (isJwtError && !original._retry) {
            original._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const rt = store.getState().auth.refreshToken;
                    if (!rt) throw new Error("no_refresh");
                    const r = await Axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>("/api/refresh-token", {
                        refreshToken: rt,
                    });
                    const tokens = r.data?.body;
                    if (!tokens?.accessToken || !tokens?.refreshToken) {
                        throw new Error("Invalid refresh response");
                    }
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
                    store.dispatch(logout());
                    Router.replace("/login");
                    return Promise.reject(error);
                }
            }

            return new Promise((resolve, reject) => {
                queue.push((token) => {
                    if (!token) {
                        store.dispatch(logout());
                        Router.replace("/login");
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

import axios, { type ApiResponse } from "@/utils/apiClient";
import type { UserRecord } from "@/types";
import { unwrapResponse } from "@/services/api";

export type AuthPayload = {
    accessToken: string;
    refreshToken: string;
    user: UserRecord;
};

export async function loginWithFirebase(idToken: string) {
    const { data } = await axios.post<ApiResponse<AuthPayload>>("/v1/auth/login", { idToken });
    return unwrapResponse(data);
}

export async function loginWithLineProfile(lineProfile: {
    userId: string;
    displayName?: string | null;
    pictureUrl?: string | null;
    email?: string | null;
}) {
    const { data } = await axios.post<ApiResponse<AuthPayload>>("/v1/auth/login", { lineProfile });
    return unwrapResponse(data);
}

export async function fetchMe() {
    const { data } = await axios.get<ApiResponse<{ user: UserRecord }>>("/v1/auth/me");
    return unwrapResponse(data).user;
}

import adminAxios from "@/utils/adminApiClient";
import { unwrapResponse } from "@/services/api";
import type { ApiResponse } from "@/utils/apiClient";
import type { AdminAuthPayload, AdminSession } from "@/types/admin";

export async function adminLogin(payload: { username: string; password: string }) {
    const { data } = await adminAxios.post<ApiResponse<AdminAuthPayload>>("/v1/admin/auth/login", payload);
    return unwrapResponse(data);
}

export async function adminRefresh(refreshToken: string) {
    const { data } = await adminAxios.post<ApiResponse<AdminAuthPayload>>("/v1/admin/auth/refresh", { refreshToken });
    return unwrapResponse(data);
}

export async function fetchAdminSession() {
    const { data } = await adminAxios.get<ApiResponse<{ session: AdminSession }>>("/v1/admin/auth/session");
    return unwrapResponse(data).session;
}

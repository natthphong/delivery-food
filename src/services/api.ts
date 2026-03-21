import type { ApiResponse } from "@/utils/apiClient";

export function unwrapResponse<T>(response: ApiResponse<T>): T {
    if (response.code !== "OK") {
        throw new Error(response.message || "Request failed");
    }
    return response.body;
}

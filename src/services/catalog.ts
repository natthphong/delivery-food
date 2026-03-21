import axios, { type ApiResponse } from "@/utils/apiClient";
import type { BranchSearchResult, Category, MenuItem, BranchSummary } from "@/types";
import type { TransactionMethod } from "@/types/transaction";
import { unwrapResponse } from "@/services/api";

export type SearchPayload = {
    branches: BranchSearchResult[];
    categories: Category[];
};

export type BranchMenuPayload = {
    branch: BranchSummary;
    menu: MenuItem[];
    page: number;
    size: number;
    total: number;
};

export async function searchBranches(params: {
    q?: string;
    categoryId?: number | null;
    lat?: number | null;
    lng?: number | null;
}) {
    const { data } = await axios.get<ApiResponse<SearchPayload>>("/v1/catalog/search", { params });
    return unwrapResponse(data);
}

export async function fetchBranchMenu(branchId: number | string, opts: { q?: string; page?: number; size?: number } = {}) {
    const { data } = await axios.get<ApiResponse<BranchMenuPayload>>(`/v1/catalog/branches/${branchId}/menu`, {
        params: { q: opts.q, page: opts.page ?? 1, size: opts.size ?? 20 },
    });
    return unwrapResponse(data);
}

export async function fetchFeaturedMenu(branchId: number | string) {
    const { data } = await axios.get<ApiResponse<BranchMenuPayload>>(`/v1/catalog/branches/${branchId}/featured`);
    return unwrapResponse(data);
}

export async function fetchPaymentMethods(companyId: number, scope: "checkout" | "deposit" = "checkout") {
    const { data } = await axios.get<ApiResponse<{ methods: TransactionMethod[] }>>("/v1/payment-methods", {
        params: { companyId, scope },
    });
    return unwrapResponse(data).methods;
}

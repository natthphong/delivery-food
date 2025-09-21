import axios from "@/utils/apiClient";

export type ApiMenuBody = {
    branch: any;
    menu: any[];
    page?: number;
    size?: number;
    total?: number;
};

export async function fetchBranchMenu(
    branchId: number | string,
    opts: { searchBy?: string; page?: number; size?: number } = {}
) {
    const params = new URLSearchParams();
    if (opts.searchBy) params.set("searchBy", opts.searchBy);
    params.set("page", String(opts.page ?? 1));
    params.set("size", String(opts.size ?? 20));
    const { data } = await axios.get(`/api/branches/${branchId}/menu?${params.toString()}`);
    if (data?.code !== "OK") throw new Error(data?.message || "Fetch menu failed");
    return data.body as ApiMenuBody;
}

export async function fetchTopMenu(branchId: number | string) {
    const { data } = await axios.get(`/api/branches/${branchId}/top-menu`);
    if (data?.code !== "OK") throw new Error(data?.message || "Fetch top menu failed");
    return data.body as ApiMenuBody; // (no page/size/total)
}

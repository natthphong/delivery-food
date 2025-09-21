import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import axios from "@utils/apiClient";
import { getCurrentPositionWithPermission } from "@utils/geo";
import { LoaderOverlay } from "@components/common";
import SearchBar from "@/components/search/SearchBar";
import BranchList from "@/components/search/BranchList";
import type { BranchItem, BranchSampleProduct, Category } from "@/components/search/types";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

type ApiBranchProduct = {
    product_id: number;
    name: string | null;
    price: number | null;
    image_url?: string | null;
};

type ApiOpenHours = Record<string, [string, string][]>;

type ApiBranchRecord = {
    branch_id: number;
    branch_name: string;
    image_url?: string | null;
    address_line?: string | null;
    lat?: number | null;
    lng?: number | null;
    is_force_closed: boolean;
    open_hours?: ApiOpenHours | null;
    distance_m?: number | null;
    products_sample?: ApiBranchProduct[];
};

type ApiSearchResponse = {
    code: string;
    message: string;
    body: {
        branches: ApiBranchRecord[];
        categories: { id: number; name: string }[];
    };
};

const DAY_KEYS: Array<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"> = [
    "sun",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
];

function hhmmToMinutes(hhmm: string): number {
    const [hours, minutes] = hhmm.split(":").map((value) => Number.parseInt(value, 10));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return Number.NaN;
    }
    return (hours || 0) * 60 + (minutes || 0);
}

function isOpenNow(openHours?: ApiOpenHours | null, isForceClosed?: boolean): boolean {
    if (isForceClosed) return false;
    if (!openHours) return true;

    const now = new Date();
    const dayKey = DAY_KEYS[now.getDay()] ?? "sun";
    const slots = openHours[dayKey];
    if (!Array.isArray(slots) || slots.length === 0) {
        return false;
    }

    const minutesNow = now.getHours() * 60 + now.getMinutes();

    return slots.some(([start, end]) => {
        const startMinutes = hhmmToMinutes(start);
        const endMinutes = hhmmToMinutes(end);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
            return false;
        }

        if (endMinutes < startMinutes) {
            return minutesNow >= startMinutes || minutesNow <= endMinutes;
        }

        return minutesNow >= startMinutes && minutesNow <= endMinutes;
    });
}

function mapBranchProduct(product: ApiBranchProduct): BranchSampleProduct | null {
    if (!product || typeof product.product_id !== "number") {
        return null;
    }

    return {
        id: product.product_id,
        name: product.name ?? "",
        price: typeof product.price === "number" ? product.price : undefined,
        image_url: product.image_url ?? null,
    };
}

function mapBranchRecord(record: ApiBranchRecord): BranchItem | null {
    if (!record || typeof record.branch_id !== "number" || !record.branch_name) {
        return null;
    }

    const distanceKm =
        typeof record.distance_m === "number"
            ? Number((record.distance_m / 1000).toFixed(2))
            : null;

    const productsSample = Array.isArray(record.products_sample)
        ? (record.products_sample.map(mapBranchProduct).filter(Boolean) as BranchSampleProduct[])
        : [];

    const computedIsOpen = isOpenNow(record.open_hours ?? null, record.is_force_closed);

    return {
        id: record.branch_id,
        name: record.branch_name,
        image_url: record.image_url ?? null,
        address_line: record.address_line ?? null,
        is_force_closed: record.is_force_closed,
        is_open: computedIsOpen,
        distance_km: distanceKm,
        products_sample: productsSample,
    };
}

function mapCategory(record: { id: number; name: string }): Category | null {
    if (!record || typeof record.id !== "number" || !record.name) {
        return null;
    }
    return { id: record.id, name: record.name };
}

/** ---------- Page ---------- */
const SearchPage: NextPage = () => {
    const router = useRouter();
    const { t } = useI18n();

    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");

    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);

    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const position = await getCurrentPositionWithPermission();
            if (!cancelled) setCoords(position);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let ignore = false;

        const runSearch = async () => {
            setLoading(true);
            try {
                const { data } = await axios.get<ApiSearchResponse>("/api/search", {
                    params: {
                        q: submittedQuery,
                        categoryId: categoryId ?? undefined,
                        lat: coords?.lat,
                        lng: coords?.lng,
                    },
                });

                if (!data || data.code !== "OK" || !data.body) {
                    throw new Error(data?.message || t(I18N_KEYS.SEARCH_ERROR_DEFAULT));
                }

                const body = data.body;
                const mappedCategories = Array.isArray(body.categories)
                    ? (body.categories.map(mapCategory).filter(Boolean) as Category[])
                    : [];

                const mappedBranches = Array.isArray(body.branches)
                    ? (body.branches.map(mapBranchRecord).filter(Boolean) as BranchItem[])
                    : [];

                const sorted = [...mappedBranches].sort((a, b) => {
                    const distanceA =
                        typeof a.distance_km === "number" ? a.distance_km : Number.POSITIVE_INFINITY;
                    const distanceB =
                        typeof b.distance_km === "number" ? b.distance_km : Number.POSITIVE_INFINITY;
                    return distanceA - distanceB;
                });

                if (!ignore) {
                    setBranches(sorted);
                    setCategories(mappedCategories);
                    setError(null);
                }
            } catch (err: any) {
                if (!ignore) {
                    setError(err?.message || t(I18N_KEYS.SEARCH_ERROR_DEFAULT));
                    setBranches([]);
                    setCategories([]);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        void runSearch();
        return () => {
            ignore = true;
        };
    }, [submittedQuery, categoryId, coords?.lat, coords?.lng, t]);

    const handleSubmit = () => {
        setSubmittedQuery(query.trim());
    };

    const handleViewBranch = (id: number) => {
        void router.push(`/branches/${id}`);
    };

    const loaderLabel = useMemo(
        () => `${t(I18N_KEYS.SEARCH_LOADING)} ${t(I18N_KEYS.BRAND_NAME)}`,
        [t]
    );

    return (
        <Layout>
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    onSubmit={handleSubmit}
                    categoryId={categoryId}
                    onCategoryChange={setCategoryId}
                    categories={categories}
                />

                {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

                {!loading && branches.length === 0 && !error && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                        <p>{t(I18N_KEYS.SEARCH_EMPTY)}</p>
                        <p className="mt-1 text-xs text-slate-400">{t(I18N_KEYS.SEARCH_EMPTY_HINT)}</p>
                    </div>
                )}

                <BranchList branches={branches} onView={handleViewBranch} />
            </div>
            <LoaderOverlay show={loading} label={loaderLabel} />
        </Layout>
    );
};

export default SearchPage;

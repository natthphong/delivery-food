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

/** ---------- Normalizer to handle BOTH response shapes ---------- */
function normalizeSearchPayload(payload: any): { branches: BranchItem[]; categories: Category[] } {
    const body = payload?.body ?? payload?.data?.body ?? payload;

    const rawBranches: any[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.branches)
            ? body.branches
            : [];

    const rawCategories: any[] = Array.isArray(body?.categories) ? body.categories : [];

    const branches: BranchItem[] = rawBranches
        .map((b) => {
            const id = b.id ?? b.branch_id;
            const name = b.name ?? b.branch_name;
            if (id == null || !name) return null;

            const distance_km =
                typeof b.distance_km === "number"
                    ? b.distance_km
                    : typeof b.distance_m === "number"
                        ? b.distance_m / 1000
                        : null;

            const is_force_closed = !!(b.is_force_closed ?? false);
            const is_open = typeof b.is_open === "boolean" ? b.is_open : !is_force_closed;
            const open_hours = b.open_hours
            const products_sample_raw = Array.isArray(b.products_sample) ? b.products_sample : [];
            const products_sample: BranchSampleProduct[] = products_sample_raw
                .map((p: any) => {
                    const pid = p.id ?? p.product_id;
                    if (pid == null) return null;
                    return {
                        id: pid,
                        name: p.name,
                        price: typeof p.price === "number" ? p.price : undefined,
                        price_effective: typeof p.price_effective === "number" ? p.price_effective : undefined,
                        image_url: p.image_url ?? null,
                    } as BranchSampleProduct;
                })
                .filter(Boolean) as BranchSampleProduct[];

            return {
                id,
                name,
                image_url: b.image_url ?? null,
                is_force_closed,
                is_open,
                distance_km,
                address_line: b.address_line ?? null,
                products_sample,
                open_hours,
            } as BranchItem;
        })
        .filter(Boolean) as BranchItem[];

    const categories: Category[] = rawCategories
        .map((c) => {
            if (c?.id == null || !c?.name) return null;
            return { id: c.id, name: c.name } as Category;
        })
        .filter(Boolean) as Category[];

    return { branches, categories };
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
                const { data } = await axios.get("/api/search", {
                    params: {
                        q: submittedQuery,
                        categoryId: categoryId ?? undefined,
                        lat: coords?.lat,
                        lng: coords?.lng,
                    },
                });

                if (data?.code !== "OK") {
                    throw new Error(data?.message || t(I18N_KEYS.SEARCH_ERROR_DEFAULT));
                }

                const normalized = normalizeSearchPayload(data);
                const sorted = normalized.branches.sort((a, b) => {
                    const A = typeof a.distance_km === "number" ? a.distance_km : Number.POSITIVE_INFINITY;
                    const B = typeof b.distance_km === "number" ? b.distance_km : Number.POSITIVE_INFINITY;
                    return A - B;
                });

                if (!ignore) {
                    setBranches(sorted);
                    setCategories(normalized.categories);
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
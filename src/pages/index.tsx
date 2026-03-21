import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import { LoaderOverlay } from "@components/common";
import SearchBar from "@/components/search/SearchBar";
import BranchList from "@/components/search/BranchList";
import type { BranchItem, Category } from "@/components/search/types";
import { getCurrentPositionWithPermission } from "@utils/geo";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { searchBranches } from "@/services/catalog";

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
        void getCurrentPositionWithPermission().then((position) => {
            if (!cancelled) setCoords(position);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        searchBranches({
            q: submittedQuery || undefined,
            categoryId,
            lat: coords?.lat ?? undefined,
            lng: coords?.lng ?? undefined,
        })
            .then((payload) => {
                if (ignore) return;
                setBranches(payload.branches);
                setCategories(payload.categories);
                setError(null);
            })
            .catch((err: any) => {
                if (ignore) return;
                setError(err?.message || t(I18N_KEYS.SEARCH_ERROR_DEFAULT));
                setBranches([]);
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, [categoryId, coords?.lat, coords?.lng, submittedQuery, t]);

    const loaderLabel = useMemo(() => `${t(I18N_KEYS.SEARCH_LOADING)} ${t(I18N_KEYS.BRAND_NAME)}`, [t]);

    return (
        <Layout>
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_42%),linear-gradient(135deg,#0f172a_0%,#111827_40%,#1f2937_100%)] px-6 py-8 text-white shadow-xl sm:px-8">
                    <div className="max-w-2xl">
                        <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                            Mobile-first ordering
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                            Browse nearby kitchens, compare menus, and check out in a few taps.
                        </h1>
                        <p className="mt-3 max-w-xl text-sm text-slate-200 sm:text-base">
                            Delivery flow is now powered by the dedicated Go backend, so search, cart, payment, and order history stay in sync end to end.
                        </p>
                    </div>
                </section>

                <SearchBar
                    query={query}
                    onQueryChange={setQuery}
                    onSubmit={() => setSubmittedQuery(query.trim())}
                    categoryId={categoryId}
                    onCategoryChange={setCategoryId}
                    categories={categories}
                />

                {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                ) : null}

                {!loading && branches.length === 0 && !error ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                        <p>{t(I18N_KEYS.SEARCH_EMPTY)}</p>
                        <p className="mt-1 text-xs text-slate-400">{t(I18N_KEYS.SEARCH_EMPTY_HINT)}</p>
                    </div>
                ) : null}

                <BranchList branches={branches} onView={(id) => void router.push(`/branches/${id}`)} />
            </div>

            <LoaderOverlay show={loading} label={loaderLabel} />
        </Layout>
    );
};

export default SearchPage;

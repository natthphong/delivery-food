import React, { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import Layout from "@components/Layout";
import axios from "@utils/apiClient";
import { formatTHB } from "@utils/currency";
import { getCurrentPositionWithPermission } from "@utils/geo";
import { LoaderOverlay } from "@components/common";

export type Category = { id: number; name: string };
export type BranchSampleProduct = { id: number; name: string; price?: number; price_effective?: number };
export type BranchItem = {
    id: number;
    name: string;
    image_url?: string | null;
    is_open: boolean;
    is_force_closed: boolean;
    distance_km?: number | null;
    products_sample?: BranchSampleProduct[];
    address_line?: string | null;
};
export type SearchBody = { branches: BranchItem[]; categories?: Category[] };

type SearchResponse = { code: string; message: string; body: SearchBody };

type Coordinates = { lat: number; lng: number } | null;

const SearchPage: NextPage = () => {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [branches, setBranches] = useState<BranchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [coords, setCoords] = useState<Coordinates>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const position = await getCurrentPositionWithPermission();
            if (!cancelled) {
                setCoords(position);
            }
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
                const response = await axios.get<SearchResponse>("/api/search", {
                    params: {
                        q: submittedQuery,
                        categoryId: categoryId ?? undefined,
                        lat: coords?.lat,
                        lng: coords?.lng,
                    },
                });
                if (response.data.code !== "OK") {
                    throw new Error(response.data.message || "Search failed");
                }
                const body = response.data.body;
                if (ignore) return;
                if (body.categories) {
                    setCategories(body.categories);
                }
                const sortedBranches = [...(body.branches ?? [])].sort((a, b) => {
                    const distA = typeof a.distance_km === "number" ? a.distance_km : Number.POSITIVE_INFINITY;
                    const distB = typeof b.distance_km === "number" ? b.distance_km : Number.POSITIVE_INFINITY;
                    return distA - distB;
                });
                setBranches(sortedBranches);
                setError(null);
            } catch (err: any) {
                if (ignore) return;
                const msg = err?.message || "Unable to fetch results";
                setError(msg);
                setBranches([]);
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };
        void runSearch();
        return () => {
            ignore = true;
        };
    }, [submittedQuery, categoryId, coords?.lat, coords?.lng]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmittedQuery(query.trim());
    };

    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setCategoryId(value ? Number(value) : null);
    };

    const badgeForBranch = (branch: BranchItem) => {
        if (branch.is_force_closed) {
            return { label: "Closed (manual)", className: "border-rose-200 bg-rose-50 text-rose-700" };
        }
        if (branch.is_open) {
            return { label: "Open", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
        }
        return { label: "Closed", className: "border-slate-200 bg-slate-100 text-slate-600" };
    };

    const distanceLabel = (branch: BranchItem) => {
        if (typeof branch.distance_km !== "number") return null;
        return `${branch.distance_km.toFixed(1)} km`;
    };

    const samplesForBranch = (branch: BranchItem) => {
        return (branch.products_sample ?? []).slice(0, 3);
    };

    const branchCards = useMemo(
        () =>
            branches.map((branch) => {
                const badge = badgeForBranch(branch);
                const distance = distanceLabel(branch);
                const samples = samplesForBranch(branch);
                return (
                    <div
                        key={branch.id}
                        className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                {branch.image_url ? (
                                    <img
                                        src={branch.image_url}
                                        alt={branch.name}
                                        className="h-40 w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-40 items-center justify-center text-sm text-slate-400">No image</div>
                                )}
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">{branch.name}</h3>
                                        {branch.address_line && (
                                            <p className="text-sm text-slate-500">{branch.address_line}</p>
                                        )}
                                    </div>
                                    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
                                        {badge.label}
                                    </div>
                                </div>
                                {distance && <p className="text-sm text-slate-500">Distance: {distance}</p>}
                                {samples.length > 0 && (
                                    <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                                        {samples.map((item) => {
                                            const price = item.price_effective ?? item.price ?? null;
                                            return (
                                                <span
                                                    key={item.id}
                                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1"
                                                >
                                                    <span className="font-medium text-slate-700">{item.name}</span>
                                                    <span className="text-xs text-slate-500">{formatTHB(price)}</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="mt-auto">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/branches/${branch.id}`)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99]"
                                    >
                                        View menu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }),
        [branches, router]
    );

    return (
        <Layout>
            <div className="mx-auto flex max-w-5xl flex-col gap-6">
                <div className="sticky top-4 z-10 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                        <div className="flex-1">
                            <label htmlFor="search-query" className="text-xs font-medium text-slate-500">
                                Search dishes or restaurants
                            </label>
                            <input
                                id="search-query"
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                placeholder="What are you craving today?"
                            />
                        </div>
                        <div className="md:w-64">
                            <label htmlFor="category-filter" className="text-xs font-medium text-slate-500">
                                Category
                            </label>
                            <select
                                id="category-filter"
                                value={categoryId ?? ""}
                                onChange={handleCategoryChange}
                                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            >
                                <option value="">All categories</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 active:scale-[0.99] md:mt-6"
                        >
                            Search
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                )}

                {!loading && branches.length === 0 && !error && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                        No branches found. Try adjusting your search.
                    </div>
                )}

                <div className="grid gap-4">{branchCards}</div>
            </div>
            <LoaderOverlay show={loading} label="Searching FoodieGo" />
        </Layout>
    );
};

export default SearchPage;

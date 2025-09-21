import React, { useCallback } from "react";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useI18n } from "@/utils/i18n";
import type { Category } from "@/components/search/types";

type SearchBarProps = {
    query: string;
    onQueryChange: (value: string) => void;
    onSubmit: () => void;
    categoryId: number | null;
    onCategoryChange: (id: number | null) => void;
    categories: Category[];
};

const SearchBar: React.FC<SearchBarProps> = ({
    query,
    onQueryChange,
    onSubmit,
    categoryId,
    onCategoryChange,
    categories,
}) => {
    const { t } = useI18n();

    const handleSubmit = useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            onSubmit();
        },
        [onSubmit]
    );

    return (
        <div className="sticky top-4 z-10 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                <div className="flex-1">
                    <label htmlFor="search-query" className="text-xs font-medium text-slate-500">
                        {t(I18N_KEYS.SEARCH_LABEL)}
                    </label>
                    <input
                        id="search-query"
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        placeholder={t(I18N_KEYS.SEARCH_PLACEHOLDER)}
                    />
                </div>
                <div className="md:w-64">
                    <label htmlFor="category-filter" className="text-xs font-medium text-slate-500">
                        {t(I18N_KEYS.SEARCH_CATEGORY)}
                    </label>
                    <select
                        id="category-filter"
                        value={categoryId ?? ""}
                        onChange={(event) => {
                            const value = event.target.value;
                            onCategoryChange(value ? Number(value) : null);
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                        <option value="">{t(I18N_KEYS.SEARCH_CATEGORY_ALL)}</option>
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
                    {t(I18N_KEYS.SEARCH_BUTTON)}
                </button>
            </form>
        </div>
    );
};

export default SearchBar;

import React, { useMemo } from "react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

type Props = {
    searchBy: string;
    onSearchByChange: (value: string) => void;
    tab: "all" | "top";
    onTabChange: (tab: "all" | "top") => void;
    page: number;
    size: number;
    total?: number | null;
    onPageChange: (page: number) => void;
    onSizeChange: (size: number) => void;
};

const PAGE_SIZE_OPTIONS = [12, 20, 30, 40];

const BranchMenuToolbar: React.FC<Props> = ({
    searchBy,
    onSearchByChange,
    tab,
    onTabChange,
    page,
    size,
    total,
    onPageChange,
    onSizeChange,
}) => {
    const { t } = useI18n();

    const totalPages = useMemo(() => {
        if (typeof total === "number" && total >= 0) {
            const computed = Math.ceil(total / size);
            return Math.max(1, computed || 0);
        }
        return 1;
    }, [size, total]);

    const isAllTab = tab === "all";
    const disablePagination = !isAllTab;
    const disablePrev = disablePagination || page <= 1;
    const disableNext = disablePagination || page >= totalPages;

    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1">
                    <button
                        type="button"
                        onClick={() => onTabChange("all")}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            tab === "all"
                                ? "bg-white shadow-sm text-slate-900"
                                : "text-slate-600 hover:bg-white/60"
                        }`}
                        aria-pressed={tab === "all"}
                    >
                        {t(I18N_KEYS.BRANCH_TAB_ALL)}
                    </button>
                    <button
                        type="button"
                        onClick={() => onTabChange("top")}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${
                            tab === "top"
                                ? "bg-white shadow-sm text-slate-900"
                                : "text-slate-600 hover:bg-white/60"
                        }`}
                        aria-pressed={tab === "top"}
                    >
                        {t(I18N_KEYS.BRANCH_TAB_TOP)}
                    </button>
                </div>
                <div className="relative flex-1">
                    <label htmlFor="branch-menu-search" className="sr-only">
                        {t(I18N_KEYS.BRANCH_SEARCH_PLACEHOLDER)}
                    </label>
                    <input
                        id="branch-menu-search"
                        type="search"
                        value={searchBy}
                        onChange={(event) => onSearchByChange(event.target.value)}
                        placeholder={t(I18N_KEYS.BRANCH_SEARCH_PLACEHOLDER)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center gap-2">
                    <label htmlFor="branch-menu-page-size" className="text-xs text-slate-500">
                        {t(I18N_KEYS.BRANCH_PAGINATION_PAGE_SIZE)}
                    </label>
                    <select
                        id="branch-menu-page-size"
                        value={size}
                        onChange={(event) => onSizeChange(Number(event.target.value))}
                        disabled={disablePagination}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(page - 1)}
                        disabled={disablePrev}
                        className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t(I18N_KEYS.BRANCH_PAGINATION_PREV)}
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() => onPageChange(page + 1)}
                        disabled={disableNext}
                        className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t(I18N_KEYS.BRANCH_PAGINATION_NEXT)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BranchMenuToolbar;

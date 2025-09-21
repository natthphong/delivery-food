import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { useAppDispatch, type RootState } from "@/store";
import { removeNotice } from "@/store/notificationsSlice";

const ICON_MAP: Record<string, string> = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
};

const KIND_ACCENT: Record<string, string> = {
    info: "border-emerald-100",
    success: "border-emerald-200",
    warning: "border-amber-200",
    error: "border-rose-200",
};

const NotificationCenter: React.FC = () => {
    const dispatch = useAppDispatch();
    const { t } = useI18n();
    const items = useSelector((state: RootState) => state.notifications.items);
    const timersRef = useRef<Record<string, number>>({});

    useEffect(() => {
        const activeIds = new Set(items.map((item) => item.id));
        Object.entries(timersRef.current).forEach(([id, timeoutId]) => {
            if (!activeIds.has(id)) {
                window.clearTimeout(timeoutId);
                delete timersRef.current[id];
            }
        });

        items.forEach((notice) => {
            if (timersRef.current[notice.id]) {
                return;
            }
            timersRef.current[notice.id] = window.setTimeout(() => {
                dispatch(removeNotice(notice.id));
                delete timersRef.current[notice.id];
            }, 5000);
        });

        return () => {
            Object.values(timersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
            timersRef.current = {};
        };
    }, [dispatch, items]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed top-4 right-4 z-[9999] flex max-h-screen flex-col gap-3 overflow-y-auto" aria-live="polite">
            {items.map((notice) => {
                const kind = notice.kind ?? "info";
                const icon = ICON_MAP[kind] ?? ICON_MAP.info;
                const borderAccent = KIND_ACCENT[kind] ?? KIND_ACCENT.info;
                return (
                    <div
                        key={notice.id}
                        className={`pointer-events-auto w-80 rounded-xl border ${borderAccent} bg-white p-3 shadow-md`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="text-lg" aria-hidden>
                                {icon}
                            </div>
                            <div className="flex-1 space-y-1">
                                {notice.title && <p className="text-sm font-semibold text-slate-900">{notice.title}</p>}
                                <p className="text-sm text-slate-700">{notice.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => dispatch(removeNotice(notice.id))}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                                aria-label={t(I18N_KEYS.COMMON_CLOSE)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default NotificationCenter;

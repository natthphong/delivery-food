import { useCallback } from "react";
import { useI18n } from "@/utils/i18n";

export function useAdminText() {
    const { t } = useI18n();
    return useCallback((key: string, params?: Record<string, string | number>) => t(key as any, params as any), [t]);
}

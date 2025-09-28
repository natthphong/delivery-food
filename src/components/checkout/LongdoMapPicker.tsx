"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LongdoMap, Map as LMap } from "longdomap-react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

type LongdoMapPickerProps = {
    apiKey: string;
    branch: { lat: number; lng: number };
    onConfirm: (loc: { lat: number; lng: number; distanceKm: number }) => void;
};

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };

export default function LongdoMapPicker({ apiKey, branch, onConfirm }: LongdoMapPickerProps) {
    const { t } = useI18n();

    const mapRef = useRef<LMap>();
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

    const handleMapObj = useCallback((m: LMap) => {
        if (mapRef.current !== m) {
            mapRef.current = m;
        }
    }, []);

    useEffect(() => {
        const m: any = mapRef.current;
        if (!m) return;

        try {
            m.location?.({ lat: branch.lat, lon: branch.lng });
        } catch {
            /* ignore */
        }

        const handleReady = () => {
            try {
                const loc = m.location?.();
                if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
                    setUserLoc({ lat: loc.lat, lng: loc.lon });
                } else {
                    setUserLoc({ lat: branch.lat, lng: branch.lng });
                }
            } catch {
                setUserLoc({ lat: branch.lat, lng: branch.lng });
            }
        };

        m.Event?.bind?.("ready", handleReady);
        return () => m.Event?.unbind?.("ready", handleReady);
    }, [branch.lat, branch.lng]);

    useEffect(() => {
        const m: any = mapRef.current;
        if (!m) return;

        const updateFromMap = () => {
            try {
                const loc = m.location?.();
                if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
                    setUserLoc((prev) =>
                        prev && prev.lat === loc.lat && prev.lng === loc.lon ? prev : { lat: loc.lat, lng: loc.lon }
                    );
                }
            } catch {
                /* ignore */
            }
        };

        m.Event?.bind?.("drag", updateFromMap);
        m.Event?.bind?.("zoom", updateFromMap);
        return () => {
            m.Event?.unbind?.("drag", updateFromMap);
            m.Event?.unbind?.("zoom", updateFromMap);
        };
    }, []);

    const handleConfirm = useCallback(() => {
        const current = userLoc ?? branch ?? DEFAULT_CENTER;
        const distanceKm = +haversineKm(current, branch).toFixed(2);
        onConfirm({ lat: current.lat, lng: current.lng, distanceKm });
    }, [branch, onConfirm, userLoc]);

    const displayLocation = useMemo(() => userLoc ?? branch ?? DEFAULT_CENTER, [userLoc, branch]);

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.CHECKOUT_LOCATION_TITLE)}</h2>
                <p className="text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_LOCATION_SUBTITLE)}</p>
            </div>

            <div className="space-y-2">
                <div className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200">
                    <LongdoMap apiKey={apiKey} mapObj={handleMapObj} height="100%" />
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">
                            {t(I18N_KEYS.CHECKOUT_LOCATION_COORDINATES_LABEL)}: {displayLocation.lat.toFixed(5)},{" "}
                            {displayLocation.lng.toFixed(5)}
                        </span>
                        <span>
                            {t(I18N_KEYS.CHECKOUT_LOCATION_DISTANCE_LABEL)}: {+haversineKm(displayLocation, branch).toFixed(2)} km
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    >
                        {t(I18N_KEYS.CHECKOUT_LOCATION_CONFIRM_BUTTON)}
                    </button>
                </div>
            </div>
        </div>
    );
}

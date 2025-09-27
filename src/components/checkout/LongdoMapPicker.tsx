"use client";

import React, { useCallback, useEffect, useState } from "react";
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
    const [map, setMap] = useState<LMap>();
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

    const onReady = useCallback(() => {
        try {
            const loc = (map as any)?.location?.();
            if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
                setUserLoc({ lat: loc.lat, lng: loc.lon });
            } else {
                setUserLoc({ lat: branch.lat, lng: branch.lng });
            }
        } catch {
            setUserLoc({ lat: branch.lat, lng: branch.lng });
        }
    }, [branch.lat, branch.lng, map]);

    useEffect(() => {
        if (!map) return;
        (map as any)?.location?.({ lat: branch.lat, lon: branch.lng });
        (map as any)?.Event?.bind?.("ready", onReady);
        return () => (map as any)?.Event?.unbind?.("ready", onReady);
    }, [branch.lat, branch.lng, map, onReady]);

    useEffect(() => {
        if (!map) return;
        const interval = window.setInterval(() => {
            try {
                const loc = (map as any)?.location?.();
                if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
                    setUserLoc({ lat: loc.lat, lng: loc.lon });
                }
            } catch {
                // ignore polling errors
            }
        }, 800);
        return () => window.clearInterval(interval);
    }, [map]);

    const handleConfirm = useCallback(() => {
        if (!userLoc) return;
        const distanceKm = +haversineKm(userLoc, branch).toFixed(2);
        onConfirm({ ...userLoc, distanceKm });
    }, [branch, onConfirm, userLoc]);

    const displayLocation = userLoc ?? branch ?? DEFAULT_CENTER;

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.CHECKOUT_LOCATION_TITLE)}</h2>
                <p className="text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_LOCATION_SUBTITLE)}</p>
            </div>
            <div className="space-y-2">
                <div className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200">
                    <LongdoMap apiKey={apiKey} mapObj={(m: LMap) => setMap(m)} height="100%" />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                    <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">
                            {t(I18N_KEYS.CHECKOUT_LOCATION_COORDINATES_LABEL)}: {displayLocation.lat.toFixed(5)}, {" "}
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

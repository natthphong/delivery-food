"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LongdoMap, Map as LMap } from "longdomap-react";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";

type Coords = { lat: number; lng: number };

type LongdoMapPickerProps = {
    apiKey: string;
    branch: Coords;
    initialCustomer?: Coords | null;
    onConfirm: (loc: { lat: number; lng: number; distanceKm: number }) => void;
};

const DEFAULT_CENTER: Coords = { lat: 13.7563, lng: 100.5018 };

function haversineKm(a: Coords, b: Coords) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const aa = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
    return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export default function LongdoMapPicker({ apiKey, branch, initialCustomer, onConfirm }: LongdoMapPickerProps) {
    const { t } = useI18n();
    const mapRef = useRef<LMap>();
    const [center, setCenter] = useState<Coords>(initialCustomer ?? DEFAULT_CENTER);

    const handleMapObj = useCallback((mapInstance: LMap) => {
        if (mapRef.current !== mapInstance) {
            mapRef.current = mapInstance;
        }
    }, []);

    useEffect(() => {
        const map: any = mapRef.current;
        if (!map) return;
        const desired = initialCustomer ?? DEFAULT_CENTER;

        const handleReady = () => {
            try {
                map.location?.({ lon: desired.lng, lat: desired.lat });
                setCenter(desired);
            } catch {
                // ignore
            }
        };

        map.Event?.bind?.("ready", handleReady);
        return () => {
            map.Event?.unbind?.("ready", handleReady);
        };
    }, [initialCustomer]);

    useEffect(() => {
        const map: any = mapRef.current;
        if (!map) return;

        const updateFromMap = () => {
            try {
                const loc = map.location?.();
                if (loc && typeof loc.lat === "number" && typeof loc.lon === "number") {
                    setCenter((prev) =>
                        prev.lat === loc.lat && prev.lng === loc.lon ? prev : { lat: loc.lat, lng: loc.lon }
                    );
                }
            } catch {
                // ignore
            }
        };

        map.Event?.bind?.("drag", updateFromMap);
        map.Event?.bind?.("zoom", updateFromMap);
        return () => {
            map.Event?.unbind?.("drag", updateFromMap);
            map.Event?.unbind?.("zoom", updateFromMap);
        };
    }, []);

    useEffect(() => {
        if (!initialCustomer) return;
        setCenter(initialCustomer);
        const map: any = mapRef.current;
        if (!map) return;
        try {
            map.location?.({ lon: initialCustomer.lng, lat: initialCustomer.lat });
        } catch {
            // ignore recenter errors
        }
    }, [initialCustomer]);

    const distanceKm = useMemo(() => +haversineKm(center, branch).toFixed(2), [center, branch]);

    const handleConfirm = useCallback(() => {
        onConfirm({ lat: center.lat, lng: center.lng, distanceKm });
    }, [center.lat, center.lng, distanceKm, onConfirm]);

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
                            {t(I18N_KEYS.CHECKOUT_LOCATION_COORDINATES_LABEL)}: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
                        </span>
                        <span>
                            {t(I18N_KEYS.CHECKOUT_LOCATION_DISTANCE_LABEL)}: {distanceKm} km
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

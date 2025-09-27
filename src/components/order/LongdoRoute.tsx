"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { LongdoMap, Map as LMap } from "longdomap-react";

type LatLng = { lat: number; lng: number };

type LongdoRouteProps = {
    apiKey: string;
    branch: LatLng;
    customer: LatLng;
    show: boolean;
};

export default function LongdoRoute({ apiKey, branch, customer, show }: LongdoRouteProps) {
    const [map, setMap] = useState<LMap>();
    const resultRef = useRef<HTMLDivElement>(null);

    const onReady = useCallback(() => {
        if (!show || !map) return;
        const Marker = (window as any).longdo?.Marker;
        const route = (map as any)?.Route;

        route?.placeholder?.(resultRef.current || undefined);
        route?.clear?.();

        if (Marker) {
            const branchMarker = new Marker({ lon: branch.lng, lat: branch.lat }, { title: "", detail: "branch" });
            route?.add?.(branchMarker);
        } else {
            route?.add?.({ lon: branch.lng, lat: branch.lat });
        }
        route?.add?.({ lon: customer.lng, lat: customer.lat });
        route?.search?.();
    }, [branch.lat, branch.lng, customer.lat, customer.lng, map, show]);

    useEffect(() => {
        if (!map) return;
        (map as any)?.Event?.bind?.("ready", onReady);
        return () => (map as any)?.Event?.unbind?.("ready", onReady);
    }, [map, onReady]);

    if (!show) return null;

    return (
        <div className="space-y-2">
            <div className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200">
                <LongdoMap apiKey={apiKey} mapObj={(m: LMap) => setMap(m)} height="100%" />
            </div>
            <div ref={resultRef} className="rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-600" />
        </div>
    );
}

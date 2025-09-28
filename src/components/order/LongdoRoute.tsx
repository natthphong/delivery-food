"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { LongdoMap, Map as LMap } from "longdomap-react";

type Coords = { lat: number; lng: number };

type Props = {
    apiKey: string;
    branch: Coords;
    customer: Coords;
    show?: boolean;
    height?: string;
};

export default function LongdoRoute({ apiKey, branch, customer, show = true, height = "320px" }: Props) {
    const mapRef = useRef<LMap>();
    const readyRef = useRef(false);
    const longdoRef = useRef<any>(null);

    const handleMapObj = useCallback((mapInstance: LMap) => {
        if (mapRef.current !== mapInstance) {
            mapRef.current = mapInstance;
        }
    }, []);

    useEffect(() => {
        longdoRef.current = (window as any)?.longdo ?? null;
    }, []);

    const rebuildRoute = useCallback(() => {
        const map: any = mapRef.current;
        const longdo = longdoRef.current;
        if (!map || !longdo) return;

        try {
            map.Route?.clear?.();
            map.Overlays?.clear?.();
        } catch {
            // ignore cleanup issues
        }

        const branchPoint = { lon: branch.lng, lat: branch.lat };
        const customerPoint = { lon: customer.lng, lat: customer.lat };

        try {
            const branchMarker = new longdo.Marker(branchPoint, { title: "Branch" });
            const customerMarker = new longdo.Marker(customerPoint, { title: "Customer" });
            map.Overlays?.add?.(branchMarker);
            map.Overlays?.add?.(customerMarker);
        } catch {
            // ignore marker issues if Marker constructor unavailable
        }

        map.Route?.add?.(branchPoint);
        map.Route?.add?.(customerPoint);

        try {
            map.location?.(branchPoint);
            map.Route?.search?.();
            map.Route?.auto?.();
        } catch {
            // ignore route display issues
        }
    }, [branch.lat, branch.lng, customer.lat, customer.lng]);

    useEffect(() => {
        const map: any = mapRef.current;
        if (!map) return;

        const handleReady = () => {
            readyRef.current = true;
            rebuildRoute();
        };

        if (readyRef.current) {
            rebuildRoute();
            return;
        }

        map.Event?.bind?.("ready", handleReady);
        return () => {
            map.Event?.unbind?.("ready", handleReady);
        };
    }, [rebuildRoute]);

    if (!show) return null;

    return (
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200" style={{ height }}>
            <LongdoMap apiKey={apiKey} mapObj={handleMapObj} height="100%" />
        </div>
    );
}

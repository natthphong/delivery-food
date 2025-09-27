import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { loadLongdoMap, destroyLongdoMap } from "@/utils/longdo";

export type Map = any;

type LongdoMapProps = {
    apiKey: string;
    mapObj?: (map: Map) => void;
    height?: string | number;
    width?: string | number;
};

function normalizeSize(value: string | number | undefined, fallback: string): string {
    if (typeof value === "number") {
        return `${value}px`;
    }
    if (typeof value === "string" && value.trim()) {
        return value;
    }
    return fallback;
}

export function LongdoMap({ apiKey, mapObj, height, width }: LongdoMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<Map | null>(null);

    useEffect(() => {
        let cancelled = false;
        let localMap: Map | null = null;
        loadLongdoMap(apiKey)
            .then((longdo) => {
                if (cancelled || !containerRef.current || !longdo?.Map) {
                    return;
                }
                const map = new longdo.Map({
                    placeholder: containerRef.current,
                    lastView: false,
                });
                localMap = map;
                mapRef.current = map;
                if (typeof mapObj === "function") {
                    mapObj(map);
                }
            })
            .catch(() => {
                if (typeof mapObj === "function") {
                    mapObj(null as any);
                }
            });

        return () => {
            cancelled = true;
            if (typeof mapObj === "function") {
                mapObj(null as any);
            }
            destroyLongdoMap(localMap ?? mapRef.current);
            mapRef.current = null;
        };
    }, [apiKey, mapObj]);

    const style: CSSProperties = {
        height: normalizeSize(height, "100%"),
        width: normalizeSize(width, "100%"),
    };

    return <div ref={containerRef} style={style} />;
}

export default LongdoMap;

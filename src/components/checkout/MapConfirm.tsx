import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";
import { useI18n } from "@/utils/i18n";
import { I18N_KEYS } from "@/constants/i18nKeys";
import { getCurrentPositionWithPermission } from "@/utils/geo";

export type MapConfirmValue = {
    lat: number;
    lng: number;
    distanceKm: number | null;
};

export type MapConfirmProps = {
    branchLocation: { lat: number; lng: number } | null;
    loading?: boolean;
    value: MapConfirmValue | null;
    onChange: (value: MapConfirmValue) => void;
    confirmed: boolean;
    onConfirmChange: (confirmed: boolean) => void;
};

const DEFAULT_CENTER: LatLngLiteral = { lat: 13.7563, lng: 100.5018 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

type DraggableMarkerProps = {
    position: LatLngLiteral;
    onChange: (latlng: LatLngLiteral) => void;
    icon: L.DivIcon;
};

function DraggableMarker({ position, onChange, icon }: DraggableMarkerProps) {
    const markerRef = useRef<L.Marker | null>(null);

    useMapEvents({
        click(event) {
            onChange(event.latlng);
        },
    });

    const eventHandlers = useMemo(
        () => ({
            dragend() {
                const marker = markerRef.current;
                if (!marker) return;
                const next = marker.getLatLng();
                onChange(next);
            },
        }),
        [onChange]
    );

    return (
        <Marker
            draggable
            eventHandlers={eventHandlers}
            position={position}
            icon={icon}
            ref={(instance) => {
                markerRef.current = instance;
            }}
        />
    );
}

export function MapConfirm({
    branchLocation,
    loading = false,
    value,
    onChange,
    confirmed,
    onConfirmChange,
}: MapConfirmProps) {
    const { t } = useI18n();
    const [position, setPosition] = useState<LatLngLiteral>(value ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER);
    const [detecting, setDetecting] = useState(false);
    const valueRef = useRef<MapConfirmValue | null>(value);
    const mapRef = useRef<LeafletMap | null>(null);

    const markerIcon = useMemo(
        () =>
            L.divIcon({
                className: "relative",
                html: `
                    <div class="flex h-10 w-10 -translate-x-1/2 -translate-y-full items-center justify-center">
                        <span class="inline-flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-emerald-500 shadow-lg"></span>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            }),
        []
    );

    const distanceKm = useMemo(() => {
        if (!branchLocation) return null;
        return haversineKm(position.lat, position.lng, branchLocation.lat, branchLocation.lng);
    }, [branchLocation, position.lat, position.lng]);

    useEffect(() => {
        if (!value) return;
        if (
            !valueRef.current ||
            valueRef.current.lat !== value.lat ||
            valueRef.current.lng !== value.lng ||
            valueRef.current.distanceKm !== value.distanceKm
        ) {
            valueRef.current = value;
            setPosition({ lat: value.lat, lng: value.lng });
        }
    }, [value]);

    useEffect(() => {
        if (valueRef.current) return;
        let cancelled = false;
        setDetecting(true);
        getCurrentPositionWithPermission()
            .then((coords) => {
                if (!coords || cancelled) return;
                setPosition({ lat: coords.lat, lng: coords.lng });
            })
            .finally(() => {
                if (!cancelled) {
                    setDetecting(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const payload: MapConfirmValue = {
            lat: position.lat,
            lng: position.lng,
            distanceKm: distanceKm == null ? null : Number(distanceKm.toFixed(3)),
        };
        const prev = valueRef.current;
        if (
            !prev ||
            prev.lat !== payload.lat ||
            prev.lng !== payload.lng ||
            prev.distanceKm !== payload.distanceKm
        ) {
            valueRef.current = payload;
            onChange(payload);
        }
    }, [distanceKm, onChange, position.lat, position.lng]);

    useEffect(() => {
        if (!mapRef.current) return;
        mapRef.current.setView(position, mapRef.current.getZoom());
    }, [position]);

    const handlePositionChange = useCallback(
        (next: LatLngLiteral) => {
            setPosition({ lat: next.lat, lng: next.lng });
        },
        []
    );

    const distanceLabel = useMemo(() => {
        if (distanceKm == null) {
            return t(I18N_KEYS.CHECKOUT_LOCATION_DISTANCE_UNKNOWN);
        }
        if (distanceKm < 1) {
            return `${Math.round(distanceKm * 1000)} m`;
        }
        return `${distanceKm.toFixed(2)} km`;
    }, [distanceKm, t]);

    const coordinatesLabel = useMemo(() => `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`, [position.lat, position.lng]);

    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-sm font-semibold text-slate-900">{t(I18N_KEYS.CHECKOUT_LOCATION_TITLE)}</h2>
                <p className="text-xs text-slate-500">{t(I18N_KEYS.CHECKOUT_LOCATION_SUBTITLE)}</p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                <MapContainer
                    center={position}
                    zoom={15}
                    style={{ height: 300, width: "100%" }}
                    className="h-[300px] w-full"
                    whenCreated={(map) => {
                        mapRef.current = map;
                    }}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                    {branchLocation ? (
                        <CircleMarker
                            center={branchLocation}
                            radius={10}
                            pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.2 }}
                        />
                    ) : null}
                    <DraggableMarker position={position} onChange={handlePositionChange} icon={markerIcon} />
                </MapContainer>
                <div className="space-y-3 bg-white p-4">
                    <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                            {t(I18N_KEYS.CHECKOUT_LOCATION_COORDINATES_LABEL)}: {coordinatesLabel}
                        </span>
                        <span>
                            {t(I18N_KEYS.CHECKOUT_LOCATION_DISTANCE_LABEL)}: {distanceLabel}
                        </span>
                        {detecting || loading ? (
                            <span className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-transparent" />
                                {t(I18N_KEYS.CHECKOUT_LOCATION_FETCHING)}
                            </span>
                        ) : null}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                            checked={confirmed}
                            onChange={(event) => onConfirmChange(event.target.checked)}
                        />
                        {t(I18N_KEYS.CHECKOUT_LOCATION_CONFIRM_LABEL)}
                    </label>
                </div>
            </div>
        </section>
    );
}

export default MapConfirm;

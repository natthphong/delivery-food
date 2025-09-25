import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";

type LatLngTuple = [number, number];

type PointInput = { lat: number | null; lng: number | null } | null | undefined;

type OrderLocationMapProps = {
    branch?: PointInput;
    customer?: PointInput;
};

const DEFAULT_CENTER: LatLngTuple = [13.7563, 100.5018];

function normalizePoint(point: PointInput): LatLngTuple | null {
    if (!point) return null;
    const lat = typeof point.lat === "number" ? point.lat : null;
    const lng = typeof point.lng === "number" ? point.lng : null;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    return [lat, lng];
}

function FitBounds({ branch, customer }: { branch: LatLngTuple | null; customer: LatLngTuple | null }) {
    const map = useMap();

    useEffect(() => {
        const points = [branch, customer].filter(Boolean) as LatLngTuple[];
        if (points.length === 0) {
            return;
        }
        if (points.length === 1) {
            map.setView(points[0], 15);
            return;
        }
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [24, 24] });
    }, [branch, customer, map]);

    return null;
}

export default function OrderLocationMap({ branch, customer }: OrderLocationMapProps) {
    const branchPoint = useMemo(() => normalizePoint(branch), [branch]);
    const customerPoint = useMemo(() => normalizePoint(customer), [customer]);
    const center = branchPoint ?? customerPoint ?? DEFAULT_CENTER;

    return (
        <MapContainer
            center={center}
            zoom={15}
            className="h-64 w-full rounded-3xl"
            style={{ height: 256, width: "100%" }}
            scrollWheelZoom={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {branchPoint ? (
                <CircleMarker
                    center={branchPoint}
                    radius={10}
                    pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.35 }}
                />
            ) : null}
            {customerPoint ? (
                <CircleMarker
                    center={customerPoint}
                    radius={8}
                    pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.45 }}
                />
            ) : null}
            <FitBounds branch={branchPoint} customer={customerPoint} />
        </MapContainer>
    );
}

export type Coords = { lat: number; lng: number };

export async function getCurrentPositionWithPermission(timeoutMs = 8000): Promise<Coords | null> {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
        return null;
    }

    try {
        if (typeof (navigator as any).permissions?.query === "function") {
            try {
                const permission = await (navigator as any).permissions.query({ name: "geolocation" });
                if (permission?.state === "denied") {
                    return null;
                }
            } catch {
                // ignore permission errors
            }
        }

        return await new Promise<Coords | null>((resolve) => {
            const timer = window.setTimeout(() => resolve(null), timeoutMs);
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    window.clearTimeout(timer);
                    resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                () => {
                    window.clearTimeout(timer);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
            );
        });
    } catch {
        return null;
    }
}

export default getCurrentPositionWithPermission;

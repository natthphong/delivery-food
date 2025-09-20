export async function getCurrentPositionWithPermission(): Promise<{ lat: number; lng: number } | null> {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return null;
    }

    if (!("geolocation" in navigator)) {
        return null;
    }

    try {
        if (typeof navigator.permissions?.query === "function") {
            try {
                const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
                if (status.state === "denied") {
                    return null;
                }
            } catch {
                // ignore permission errors and fallback to requesting position
            }
        }

        return await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                () => resolve(null),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
            );
        });
    } catch {
        return null;
    }
}

export default getCurrentPositionWithPermission;

let longdoPromise: Promise<any> | null = null;

export function loadLongdoMap(apiKey: string): Promise<any> {
    if (typeof window === "undefined") {
        return Promise.resolve(null);
    }
    if ((window as any).longdo) {
        return Promise.resolve((window as any).longdo);
    }
    if (longdoPromise) {
        return longdoPromise;
    }

    longdoPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>("script[data-longdo-map]");
        if (existing && (window as any).longdo) {
            resolve((window as any).longdo);
            return;
        }
        const script = existing ?? document.createElement("script");
        script.src = `https://api.longdo.com/map/?key=${encodeURIComponent(apiKey || "")}`;
        script.async = true;
        script.defer = true;
        script.dataset.longdoMap = "true";
        script.onload = () => {
            resolve((window as any).longdo ?? null);
        };
        script.onerror = (event) => {
            longdoPromise = null;
            reject(event instanceof ErrorEvent ? event.error : new Error("LONGDO_MAP_LOAD_FAILED"));
        };
        if (!existing) {
            document.body.appendChild(script);
        }
    });

    return longdoPromise;
}

export function destroyLongdoMap(map: any) {
    if (map && typeof map.destroy === "function") {
        try {
            map.destroy();
        } catch {
            // ignore destroy errors
        }
    }
}

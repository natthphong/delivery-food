// src/components/RequireAuth.tsx
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@store/index";
import { useRouter } from "next/router";
import { loadTokens, saveTokens, clearTokens } from "@utils/tokenStorage";
import { setTokens } from "@store/authSlice";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const accessToken = useSelector((s: RootState) => s.auth.accessToken);
    const refreshToken = useSelector((s: RootState) => s.auth.refreshToken);
    const [hydrated, setHydrated] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1) Hydrate once from localStorage if Redux empty
    useEffect(() => {
        const hasRedux = !!accessToken && !!refreshToken;
        if (!hasRedux) {
            const stored = loadTokens();
            if (stored?.accessToken && stored?.refreshToken) {
                dispatch(setTokens(stored));
            }
        }
        setHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2) Persist whenever Redux tokens change (after hydration)
    useEffect(() => {
        if (!hydrated) return;
        if (accessToken && refreshToken) {
            saveTokens({ accessToken, refreshToken });
        } else {
            clearTokens();
        }
    }, [accessToken, refreshToken, hydrated]);

    // 3) Redirect to /login only after hydration confirms no token
    useEffect(() => {
        if (!hydrated) return;
        if (accessToken) return;
        redirectTimer.current = setTimeout(() => {
            if (!accessToken) router.replace("/login");
        }, 50);
        return () => {
            if (redirectTimer.current) clearTimeout(redirectTimer.current);
        };
    }, [hydrated, accessToken, router]);

    if (!hydrated) return null;
    if (!accessToken) return null;
    return <>{children}</>;
}

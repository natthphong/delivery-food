// src/components/RequireAuth.tsx
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState, useAppDispatch } from "@store/index";
import { useRouter } from "next/router";
import { clearTokens, clearUser, loadTokens, loadUser, saveTokens, saveUser } from "@utils/tokenStorage";
import { setTokens, setUser } from "@store/authSlice";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const accessToken = useSelector((s: RootState) => s.auth.accessToken);
    const refreshToken = useSelector((s: RootState) => s.auth.refreshToken);
    const user = useSelector((s: RootState) => s.auth.user);
    const [hydrated, setHydrated] = useState(false);
    const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const hasTokens = !!accessToken && !!refreshToken;
        if (!hasTokens) {
            const stored = loadTokens();
            if (stored?.accessToken && stored?.refreshToken) {
                dispatch(setTokens(stored));
            }
        }
        if (!user) {
            const storedUser = loadUser();
            if (storedUser) {
                dispatch(setUser(storedUser));
            }
        }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        if (accessToken && refreshToken) {
            saveTokens({ accessToken, refreshToken });
        } else {
            clearTokens();
        }
    }, [accessToken, refreshToken, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (user) {
            saveUser(user);
        } else {
            clearUser();
        }
    }, [user, hydrated]);

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

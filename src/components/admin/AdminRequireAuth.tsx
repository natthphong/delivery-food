import { useEffect, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { RootState, useAppDispatch } from "@/store";
import { adminLogout, setAdminSession, setAdminTokens } from "@/store/adminAuthSlice";
import { fetchAdminSession } from "@/services/adminAuth";
import {
    clearAdminSession,
    clearAdminTokens,
    loadAdminSession,
    loadAdminTokens,
    saveAdminSession,
    saveAdminTokens,
} from "@/utils/tokenStorage";
import { logError } from "@/utils/logger";

export default function AdminRequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [hydrated, setHydrated] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);
    const bootstrapRef = useRef(false);
    const accessToken = useSelector((state: RootState) => state.adminAuth.accessToken);
    const refreshToken = useSelector((state: RootState) => state.adminAuth.refreshToken);
    const session = useSelector((state: RootState) => state.adminAuth.session, shallowEqual);

    useEffect(() => {
        const storedTokens = loadAdminTokens();
        const storedSession = loadAdminSession();
        if (!accessToken && storedTokens?.accessToken && storedTokens?.refreshToken) {
            dispatch(setAdminTokens(storedTokens));
        }
        if (!session && storedSession) {
            dispatch(setAdminSession(storedSession));
        }
        setHydrated(true);
    }, [accessToken, dispatch, session]);

    useEffect(() => {
        if (!hydrated) return;
        if (accessToken && refreshToken) {
            saveAdminTokens({ accessToken, refreshToken });
        } else {
            clearAdminTokens();
        }
    }, [accessToken, refreshToken, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (session) {
            saveAdminSession(session);
        } else {
            clearAdminSession();
        }
    }, [session, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (!accessToken) {
            bootstrapRef.current = false;
            if (router.pathname !== "/admin/login") {
                void router.replace("/admin/login");
            }
            return;
        }
        if (session || bootstrapRef.current || bootstrapping) {
            return;
        }

        bootstrapRef.current = true;
        setBootstrapping(true);
        fetchAdminSession()
            .then((nextSession) => {
                dispatch(setAdminSession(nextSession));
            })
            .catch((error) => {
                logError("admin session bootstrap failed", { message: error?.message });
                bootstrapRef.current = false;
                dispatch(adminLogout());
                clearAdminTokens();
                clearAdminSession();
                if (router.pathname !== "/admin/login") {
                    void router.replace("/admin/login");
                }
            })
            .finally(() => {
                setBootstrapping(false);
            });
    }, [accessToken, bootstrapping, dispatch, hydrated, router, session]);

    if (!hydrated || !accessToken || !session || bootstrapping) {
        return null;
    }

    return <>{children}</>;
}

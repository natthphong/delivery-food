import { useEffect, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { RootState, useAppDispatch } from "@store/index";
import { logout, setTokens, setUser } from "@store/authSlice";
import { clearConfig as clearConfigState, setConfig } from "@store/configSlice";
import { clearCart as clearCartState, setCart } from "@store/cartSlice";
import {
    clearCart,
    clearConfig as clearConfigStorage,
    clearTokens,
    clearUser,
    loadCart,
    loadConfig,
    loadTokens,
    loadUser,
    saveCart,
    saveConfig,
    saveTokens,
    saveUser,
} from "@utils/tokenStorage";
import { fetchBootstrap } from "@/services/app";
import { logError } from "@/utils/logger";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const dispatch = useAppDispatch();

    const accessToken = useSelector((state: RootState) => state.auth.accessToken);
    const refreshToken = useSelector((state: RootState) => state.auth.refreshToken);
    const user = useSelector((state: RootState) => state.auth.user);
    const configValues = useSelector((state: RootState) => state.config.values, shallowEqual);
    const cart = useSelector((state: RootState) => state.cart.value, shallowEqual);

    const [hydrated, setHydrated] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);
    const bootstrapRef = useRef(false);

    useEffect(() => {
        const storedTokens = loadTokens();
        const storedUser = loadUser();
        const storedConfig = loadConfig();
        const storedCart = loadCart();

        if (!accessToken && storedTokens?.accessToken && storedTokens?.refreshToken) {
            dispatch(setTokens(storedTokens));
        }
        if (!user && storedUser) {
            dispatch(setUser(storedUser));
        }
        if (Object.keys(configValues).length === 0 && storedConfig) {
            dispatch(setConfig(storedConfig));
        }
        if ((!cart.groups || cart.groups.length === 0) && storedCart) {
            dispatch(setCart(storedCart));
        }
        setHydrated(true);
    }, [accessToken, cart.groups, configValues, dispatch, user]);

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
        if (Object.keys(configValues).length > 0) {
            saveConfig(configValues);
        } else {
            clearConfigStorage();
        }
    }, [configValues, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (cart.groups.length > 0 || cart.totalQuantity > 0 || cart.totalAmount > 0) {
            saveCart(cart);
        } else {
            clearCart();
        }
    }, [cart, hydrated]);

    useEffect(() => {
        if (!hydrated) return;
        if (!accessToken) {
            bootstrapRef.current = false;
            dispatch(clearCartState());
            dispatch(clearConfigState());
            if (router.pathname !== "/login") {
                void router.replace("/login");
            }
            return;
        }
        if (bootstrapRef.current || bootstrapping) return;
        bootstrapRef.current = true;
        setBootstrapping(true);

        fetchBootstrap()
            .then((payload) => {
                dispatch(setUser(payload.user));
                dispatch(setConfig(payload.config));
                dispatch(setCart(payload.cart));
            })
            .catch((error) => {
                logError("bootstrap failed", { message: error?.message });
                bootstrapRef.current = false;
                dispatch(logout());
                dispatch(clearCartState());
                dispatch(clearConfigState());
                clearTokens();
                clearUser();
                clearCart();
                clearConfigStorage();
                if (router.pathname !== "/login") {
                    void router.replace("/login");
                }
            })
            .finally(() => {
                setBootstrapping(false);
            });
    }, [accessToken, bootstrapping, dispatch, hydrated, router]);

    if (!hydrated || !accessToken || bootstrapping) return null;
    return <>{children}</>;
}

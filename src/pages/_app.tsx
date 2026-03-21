// src/pages/_app.tsx
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import "@/styles/globals.css";
import "leaflet/dist/leaflet.css";
import RequireAuth from "@/components/RequireAuth";
import AdminRequireAuth from "@/components/admin/AdminRequireAuth";


export default function MyApp({ Component, pageProps, router }: AppProps) {
    const PUBLIC_ROUTES = ["/login", "/web-hook-line", "/admin/login", "/verify-email"];
    const isPublic = PUBLIC_ROUTES.includes(router.pathname);
    const isAdminRoute = router.pathname.startsWith("/admin");
    return (
        <Provider store={store}>
            {isPublic ? <Component {...pageProps} /> : isAdminRoute ? (
                <AdminRequireAuth>
                    <Component {...pageProps} />
                </AdminRequireAuth>
            ) : (
                <RequireAuth>
                    <Component {...pageProps} />
                </RequireAuth>
            )}
        </Provider>
    );
}

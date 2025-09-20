// src/pages/_app.tsx
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import "@/styles/globals.css";
import RequireAuth from "@/components/RequireAuth";

export default function MyApp({ Component, pageProps, router }: AppProps) {
    const PUBLIC_ROUTES = ["/login", "/web-hook-line"]; // <- add callback route
    const isPublic = PUBLIC_ROUTES.includes(router.pathname);
    return (
        <Provider store={store}>
            {isPublic ? <Component {...pageProps} /> : (
                <RequireAuth>
                    <Component {...pageProps} />
                </RequireAuth>
            )}
        </Provider>
    );
}

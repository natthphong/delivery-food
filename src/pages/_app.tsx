// src/pages/_app.tsx
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "@/store";
import "@/styles/globals.css";
import RequireAuth from "@/components/RequireAuth";

export default function MyApp({ Component, pageProps, router }: AppProps) {
    const isAuthPage = router.pathname === "/login";
    return (
        <Provider store={store}>
            {isAuthPage ? <Component {...pageProps} /> : <RequireAuth><Component {...pageProps} /></RequireAuth>}
        </Provider>
    );
}

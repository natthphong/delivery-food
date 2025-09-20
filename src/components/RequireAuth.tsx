// src/components/RequireAuth.tsx
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useRouter } from "next/router";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const token = useSelector((s: RootState) => s.auth.accessToken);

    useEffect(() => {
        if (!token) router.replace("/login");
    }, [token, router]);

    if (!token) return null;
    return <>{children}</>;
}

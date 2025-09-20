import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
    if (cachedClient) {
        return cachedClient;
    }

    const url = process.env.NEXT_PUBLIC_DELIVERY_NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_DELIVERY_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
        throw new Error(
            "Missing Supabase configuration. Please set NEXT_PUBLIC_DELIVERY_NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_DELIVERY_SUPABASE_SERVICE_ROLE_KEY."
        );
    }

    cachedClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    return cachedClient;
}

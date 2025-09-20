// src/utils/firebaseRest.ts
type FetchJsonOpts = {
    method?: "POST" | "GET";
    body?: any;
    headers?: Record<string, string>;
};

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
if (!API_KEY) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");

async function fetchJSON<T>(url: string, opts: FetchJsonOpts = {}): Promise<T> {
    const res = await fetch(url, {
        method: opts.method ?? "POST",
        headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = (data && (data.error?.message || data.error)) || res.statusText;
        throw new Error(typeof msg === "string" ? msg : "Firebase REST error");
    }
    return data as T;
}

/** Email+Password signup */
export async function signUpEmailPassword(input: { email: string; password: string }) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
    return fetchJSON<{ idToken: string; email: string; refreshToken: string; localId: string; expiresIn: string }>(url, {
        body: { email: input.email, password: input.password, returnSecureToken: true },
    });
}

/** Send verify email (requires idToken) */
export async function sendVerifyEmail(idToken: string) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;
    return fetchJSON<{ email: string }>(url, {
        body: { requestType: "VERIFY_EMAIL", idToken },
    });
}

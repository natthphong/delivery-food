// Lightweight verifier using LINE's verify endpoint
// Docs: https://developers.line.biz/en/reference/line-login/#verify-id-token
export type LineIdTokenPayload = {
    iss: string;          // issuer
    sub: string;          // userId
    aud: string;          // client id (channel id)
    exp: number;          // epoch seconds
    iat: number;          // epoch seconds
    nonce?: string;
    amr?: string[];
    name?: string;
    picture?: string;
    email?: string;
};

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
    const clientId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
    if (!clientId) throw new Error("Missing LINE_CHANNEL_ID env");

    const url = "https://api.line.me/oauth2/v2.1/verify";
    const body = new URLSearchParams({ id_token: idToken, client_id: clientId });

    const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    const data = await r.json();
    if (!r.ok || (data.error && data.error_description)) {
        throw new Error(data.error_description || "LINE id_token verify failed");
    }

    if (!data.sub || !data.aud || !data.iss) {
        throw new Error("LINE verify: insufficient token claims");
    }

    return data as LineIdTokenPayload;
}

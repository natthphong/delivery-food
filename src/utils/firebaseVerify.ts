// src/utils/firebaseVerify.ts
import { createRemoteJWKSet, jwtVerify } from "jose";
import { logInfo } from "@utils/logger";

const JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function resolveProjectConfig(): { issuer: string; audience: string } {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    }
    return {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
    };
}

export async function verifyFirebaseIdToken(idToken: string) {
    const { issuer, audience } = resolveProjectConfig();

    logInfo("verifyFirebaseIdToken: start", {
        tokenPrefix: idToken?.slice?.(0, 12) || "",
        tokenLen: idToken?.length || 0,
        issuer,
        audience,
    });

    const { payload } = await jwtVerify(idToken, JWKS, { issuer, audience });

    logInfo("verifyFirebaseIdToken: decoded", {
        user_id: payload.user_id,
        email: payload.email,
        email_verified: payload.email_verified,
        phone_number: payload.phone_number ? "present" : "absent",
        sign_in_provider: (payload as any)?.firebase?.sign_in_provider,
    });

    return payload as any;
}

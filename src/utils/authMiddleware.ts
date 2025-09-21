import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { verifyAccessToken } from "@/utils/jwt";
import { verifyFirebaseIdToken } from "@utils/firebaseVerify";

type JsonResponse = { code: string; message: string; body: any };

export type AuthContext = {
    uid: string;
    userId: number | null;
    tokenType: "access" | "idToken";
    firebaseClaims?: Record<string, any>;
};

function extractHeaderIdToken(req: NextApiRequest): string | null {
    const header = req.headers["x-id-token"];
    if (Array.isArray(header)) {
        return header.length > 0 ? header[0] : null;
    }
    return typeof header === "string" && header.trim() ? header.trim() : null;
}

function extractBodyIdToken(req: NextApiRequest): string | null {
    if (!req.body || typeof req.body !== "object") {
        return null;
    }
    const token = (req.body as any).idToken;
    return typeof token === "string" && token.trim() ? token.trim() : null;
}

export async function resolveAuth(req: NextApiRequest): Promise<AuthContext | null> {
    const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (bearerToken) {
        try {
            const payload = verifyAccessToken(bearerToken);
            if (payload?.uid) {
                return {
                    uid: payload.uid,
                    userId: typeof payload.userId === "number" ? payload.userId : null,
                    tokenType: "access",
                };
            }
        } catch {
            // fall through to id token path
        }
    }

    const idToken = extractHeaderIdToken(req) ?? extractBodyIdToken(req);
    if (!idToken) {
        return null;
    }

    try {
        const claims = await verifyFirebaseIdToken(idToken);
        const uid = (claims as any)?.user_id || (claims as any)?.uid || (claims as any)?.sub;
        if (!uid) {
            return null;
        }
        return {
            uid: String(uid),
            userId: null,
            tokenType: "idToken",
            firebaseClaims: claims as Record<string, any>,
        };
    } catch {
        return null;
    }
}

export function withAuth(handler: NextApiHandler) {
    return async (req: NextApiRequest, res: NextApiResponse<JsonResponse>) => {
        try {
            const auth = await resolveAuth(req);
            if (!auth) {
                return res
                    .status(401)
                    .json({ code: "UNAUTHORIZED", message: "Missing or invalid token", body: null });
            }
            (req as any).auth = auth;
            return handler(req, res);
        } catch {
            return res
                .status(401)
                .json({ code: "UNAUTHORIZED", message: "Missing or invalid token", body: null });
        }
    };
}

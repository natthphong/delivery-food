// src/utils/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("Missing JWT_SECRET");

const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || "900", 10);
const REFRESH_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || "604800", 10);

type Payload = { uid: string; userId: number };

const refreshStore = new Map<string, { uid: string; userId: number; exp: number }>();

export function signAccessToken(payload: Payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): Payload {
    return jwt.verify(token, JWT_SECRET) as any;
}

export function mintRefreshToken(payload: Payload) {
    const token = crypto.randomBytes(48).toString("hex");
    const exp = Math.floor(Date.now() / 1000) + REFRESH_EXPIRES_IN;
    refreshStore.set(token, { ...payload, exp });
    return token;
}

export function rotateRefreshToken(oldToken: string): { token: string; payload: Payload } {
    const rec = refreshStore.get(oldToken);
    if (!rec) throw new Error("invalid_refresh_token");
    if (rec.exp < Math.floor(Date.now() / 1000)) {
        refreshStore.delete(oldToken);
        throw new Error("expired_refresh_token");
    }
    refreshStore.delete(oldToken);
    const payload = { uid: rec.uid, userId: rec.userId };
    const token = mintRefreshToken(payload);
    return { token, payload };
}

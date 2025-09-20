// src/utils/firebaseClient.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export function makeRecaptcha(buttonId: string) {
    return new RecaptchaVerifier(getAuth(), buttonId, { size: "invisible" });
}

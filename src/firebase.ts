import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
const configured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
const app = configured
  ? initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
export async function signIn() {
  if (!auth)
    throw Error("Firebase is not configured yet. You can explore the demo.");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

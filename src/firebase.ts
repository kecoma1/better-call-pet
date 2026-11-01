import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
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
// Separate Firebase persistence keeps the demo identity when an internal member
// signs in or out. Neither identity is copied into the other's workspace.
const demoAuth = app ? getAuth(initializeApp(app.options, "demo")) : null;
export const currentWorkspaceUser = () => auth?.currentUser || demoAuth?.currentUser || null;
let openingDemo: Promise<unknown> | undefined;
export function observeWorkspaceSession(onUser: (user: User | null) => void, onError: (error: Error) => void) {
  if (!auth || !demoAuth) { onUser(null); return () => {}; }
  let active = true;
  let ready = false;
  let previous: User | null = null;
  const primary = auth, demo = demoAuth;
  const update = () => {
    const user = primary.currentUser || demo.currentUser;
    if (active && ready && user && user !== previous) {
      previous = user;
      onUser(user);
    }
  };
  const stopPrimary = onAuthStateChanged(primary, update, onError);
  const stopDemo = onAuthStateChanged(demo, update, onError);
  void Promise.all([primary.authStateReady(), demo.authStateReady()]).then(async () => {
    if (!active) return;
    ready = true;
    update();
    if (!demo.currentUser) {
      openingDemo ??= signInAnonymously(demo).finally(() => { openingDemo = undefined; });
      await openingDemo;
    }
    update();
  }).catch(() => {
    if (active && !primary.currentUser) onError(Error("The demo session could not open. Please reload to try again."));
  });
  return () => { active = false; stopPrimary(); stopDemo(); };
}
export async function signIn() {
  if (!auth)
    throw Error("Firebase is not configured yet. You can explore the demo.");
  await signInWithPopup(auth, new GoogleAuthProvider());
}

import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  primary: { currentUser: null as any, authStateReady: async () => {} },
  demo: { currentUser: null as any, authStateReady: async () => {} },
  listeners: new Map<any, Set<() => void>>(),
  anonymous: vi.fn(),
}));
vi.mock("firebase/app", () => ({ initializeApp: (options: any, name = "primary") => ({ options, name }) }));
vi.mock("firebase/auth", () => ({
  getAuth: (app: any) => app.name === "demo" ? state.demo : state.primary,
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInAnonymously: state.anonymous,
  onAuthStateChanged: (auth: any, receive: () => void) => {
    const callbacks = state.listeners.get(auth) || new Set();
    state.listeners.set(auth, callbacks); callbacks.add(receive);
    queueMicrotask(receive);
    return () => callbacks.delete(receive);
  },
}));
beforeEach(() => {
  vi.resetModules(); vi.stubEnv("VITE_FIREBASE_API_KEY", "fixture-public-key");
  state.primary.currentUser = null; state.demo.currentUser = null; state.listeners.clear();
  state.anonymous.mockReset().mockImplementation(async () => {
    state.demo.currentUser = { uid: "persistent-demo", isAnonymous: true };
    state.listeners.get(state.demo)?.forEach((receive) => receive());
  });
});
describe("automatic demo identity", () => {
  it("opens once without a Google prompt, resumes the same demo after member sign-out and unsubscribes", async () => {
    const { observeWorkspaceSession, currentWorkspaceUser } = await import("../src/firebase");
    const first = vi.fn(), second = vi.fn();
    const stopFirst = observeWorkspaceSession(first, vi.fn());
    const stopSecond = observeWorkspaceSession(second, vi.fn());
    await vi.waitFor(() => expect(first).toHaveBeenCalledWith(expect.objectContaining({ uid: "persistent-demo" })));
    expect(state.anonymous).toHaveBeenCalledOnce();
    state.primary.currentUser = { uid: "member", isAnonymous: false };
    state.listeners.get(state.primary)?.forEach((receive) => receive());
    expect(currentWorkspaceUser()?.uid).toBe("member");
    state.primary.currentUser = null;
    state.listeners.get(state.primary)?.forEach((receive) => receive());
    expect(currentWorkspaceUser()?.uid).toBe("persistent-demo");
    stopFirst(); stopSecond();
    expect([...state.listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
  });
  it("restores an existing anonymous session without generating another identity", async () => {
    state.demo.currentUser = { uid: "restored-demo", isAnonymous: true };
    const { observeWorkspaceSession } = await import("../src/firebase");
    const receive = vi.fn();
    const stop = observeWorkspaceSession(receive, vi.fn());
    await vi.waitFor(() => expect(receive).toHaveBeenCalledWith(state.demo.currentUser));
    expect(state.anonymous).not.toHaveBeenCalled(); stop();
  });
  it("shows session failures without opening a local replacement workspace", async () => {
    state.anonymous.mockRejectedValue(Error("Anonymous provider disabled"));
    const { observeWorkspaceSession } = await import("../src/firebase");
    const receive = vi.fn(), failure = vi.fn();
    const stop = observeWorkspaceSession(receive, failure);
    await vi.waitFor(() => expect(failure).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("could not open") })));
    expect(receive).not.toHaveBeenCalled(); stop();
  });
});

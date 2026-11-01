import { EventEmitter } from "node:events";
import express from "express";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), attach: vi.fn(), close: vi.fn(), run: vi.fn(), quota: vi.fn(), active: true }));
vi.mock("../src/voice-transport", () => ({ createLiveSession: state.create, attachLiveSession: state.attach, closeLiveSession: state.close }));
vi.mock("../src/agent", () => ({ runSaul: state.run }));
vi.mock("../src/tools", () => ({ aiQuota: state.quota }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => { if (token !== "member-token") throw Error("Invalid"); return { uid: "member" }; } }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ active: state.active }) }) }) }) }) }));
import { voiceCall } from "../src/voice";
import { firebaseUser } from "../src/oauth";
import type { LiveEvent } from "../src/voice-protocol";
let server: Server, base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.post("/api/voice", firebaseUser, voiceCall);
  app.use((_e: unknown, _q: express.Request, r: express.Response, _n: express.NextFunction) => r.status(400).json({ error: "Invalid call" }));
  server = app.listen(0, "127.0.0.1"); await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key"); state.active = true;
  state.create.mockReset().mockResolvedValue({ id: "session-test", sdp: "answer" });
  state.attach.mockReset(); state.close.mockReset().mockResolvedValue(1);
  state.run.mockReset().mockResolvedValue("There are two receipts awaiting review.");
  state.quota.mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
function response() {
  const r = new EventEmitter() as any;
  r.locals = { uid: "member" }; r.destroyed = false; r.writableEnded = false; r.events = [];
  r.status = vi.fn(() => r); r.set = vi.fn(() => r); r.flushHeaders = vi.fn(); r.json = vi.fn(() => r);
  r.write = (line: string) => { r.events.push(JSON.parse(line)); return true; };
  r.end = () => { r.writableEnded = true; };
  return r;
}
describe("trusted voice backend", () => {
  it("rejects missing identity and revoked membership before provider access", async () => {
    const call = (token?: string) => fetch(base + "/api/voice", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify({ sdp: "v=0" }) });
    expect((await call()).status).toBe(401);
    state.active = false;
    expect((await call("member-token")).status).toBe(401);
    expect(state.create).not.toHaveBeenCalled();
  });
  it("validates offers and does not forward provider error details", async () => {
    const invalid = await fetch(base + "/api/voice", { method: "POST", headers: { Authorization: "Bearer member-token", "Content-Type": "application/json" }, body: JSON.stringify({ sdp: "bad" }) });
    expect(invalid.status).toBe(400); expect(state.create).not.toHaveBeenCalled();
    state.create.mockRejectedValue(Error("private provider response"));
    const r = response(); await voiceCall({ body: { sdp: "v=0" } } as any, r);
    expect(r.json.mock.calls[0][0]).toEqual({ error: "Saul could not start the call. Please try again." });
  });
  it("attaches trusted controls before the SDP and delegates through the shared agent once", async () => {
    vi.useFakeTimers();
    let event!: (event: LiveEvent) => void;
    const send = vi.fn(), disconnect = vi.fn();
    state.attach.mockImplementation(async (_key, _id, receive) => { event = receive; return { send, disconnect }; });
    const r = response(), call = voiceCall({ body: { sdp: "v=0", messages: [] } } as any, r);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.events[0]).toEqual({ type: "connected", sdp: "answer" });
    event({ type: "session.input_transcript.delta", delta: "What needs review?", start_ms: 0, end_ms: 500 });
    event({ type: "session.delegation.created", delegation: { id: "delegation-1", target: "client" } });
    event({ type: "session.delegation.created", delegation: { id: "delegation-1", target: "client" } });
    await vi.advanceTimersByTimeAsync(800);
    expect(state.run).toHaveBeenCalledOnce();
    expect(state.run.mock.calls[0][0]).toBe("member");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "session.commentary.append", delegation_id: "delegation-1", content: expect.stringContaining("two receipts") }));
    r.emit("close"); await call;
    expect(state.close).toHaveBeenCalledWith("test-key", "session-test"); expect(disconnect).toHaveBeenCalledOnce();
  });
  it("closes the provider if attaching the control channel fails", async () => {
    state.attach.mockRejectedValue(Error("Attach failed"));
    const r = response(); await voiceCall({ body: { sdp: "v=0" } } as any, r);
    expect(state.close).toHaveBeenCalledWith("test-key", "session-test");
    expect(r.json.mock.calls[0][0].error).toContain("could not start");
  });
});

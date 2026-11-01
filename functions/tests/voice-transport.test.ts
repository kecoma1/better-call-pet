import {afterEach, describe, expect, it, vi} from "vitest";
import {createLiveSession, liveSessionConfig} from "../src/voice-transport";
afterEach(() => vi.unstubAllGlobals());
describe("Live provider request metadata", () => {
  it("returns the transport request ID and uses the same audited session configuration", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session: {id: "session-1"}, transport: {type: "webrtc", sdp: "answer"},
    }), {headers: {"x-request-id": "req-live"}}));
    vi.stubGlobal("fetch", fetch);
    await expect(createLiveSession("server-key", "offer", "live-model", "Spanish"))
      .resolves.toEqual({id: "session-1", sdp: "answer", requestId: "req-live"});
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.session).toEqual(liveSessionConfig("live-model", "Spanish"));
    expect(body.session.store).toBe(false);
    expect(body.transport).toEqual({type: "webrtc", sdp: "offer"});
  });
  it("uses null for an unavailable request ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session: {id: "session-1"}, transport: {type: "webrtc", sdp: "answer"},
    }))));
    expect((await createLiveSession("key", "offer", "live", "English")).requestId).toBeNull();
  });
});

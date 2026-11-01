import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn() }));
vi.mock("../src/firebase", () => ({ auth: { currentUser: { getIdToken: mocks.token } } }));
import { readVoiceStream, startVoiceCall } from "../src/services/voice";

const enc = new TextEncoder();
function stream(parts: string[]) {
  return new Response(new ReadableStream({ start(controller) { parts.forEach((p) => controller.enqueue(enc.encode(p))); controller.close(); } }));
}
beforeEach(() => { mocks.token.mockResolvedValue("test-firebase-token"); });
afterEach(() => vi.unstubAllGlobals());
describe("voice stream and lifecycle", () => {
  it("parses fragmented records and rejects invalid payloads and incomplete calls", async () => {
    const receive = vi.fn(), signal = new AbortController().signal;
    await readVoiceStream(stream(['{"type":"trans', 'cript","role":"assistant","text":"Hola £1","startMs":0,"endMs":1}\n{"type":"ended"}\n']), receive, signal);
    expect(receive.mock.calls[0][0].text).toBe("Hola £1");
    await expect(readVoiceStream(stream(['{"type":"connected","sdp":null}\n']), receive, signal)).rejects.toThrow("incomplete");
    await expect(readVoiceStream(stream(['{"type":"listening"}\n']), receive, signal)).rejects.toThrow("connection lost");
    await expect(readVoiceStream(stream(['{"type":"error","message":"Provider unavailable"}\n']), receive, signal)).rejects.toThrow("Provider unavailable");
  });
  function browser() {
    const track = { enabled: true, stop: vi.fn() };
    const microphone = { getTracks: () => [track], getAudioTracks: () => [track] };
    const media = vi.fn().mockResolvedValue(microphone);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: media } });
    const send = vi.fn(), closeChannel = vi.fn(), closePeer = vi.fn(), pause = vi.fn();
    const channel = { readyState: "open", send, close: closeChannel };
    vi.stubGlobal("RTCPeerConnection", class {
      connectionState = "new"; ontrack = null; onconnectionstatechange = null;
      createDataChannel = () => channel; addTrack = vi.fn();
      createOffer = async () => ({ type: "offer", sdp: "v=0\r\ntest" });
      setLocalDescription = async () => undefined; setRemoteDescription = async () => undefined;
      close = closePeer;
    });
    vi.stubGlobal("Audio", class { autoplay = false; srcObject = null; pause = pause; play = async () => undefined; });
    return { track, microphone, media, send, closeChannel, closePeer, pause };
  }
  const input = { language: "English" as const, messages: [] };
  it("authenticates the offer and releases all media after a successful call", async () => {
    const b = browser();
    const fetch = vi.fn().mockResolvedValue(stream(['{"type":"connected","sdp":"answer"}\n{"type":"ended"}\n']));
    vi.stubGlobal("fetch", fetch);
    await startVoiceCall(input, vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
    expect(fetch.mock.calls[0][0]).toBe("/api/voice");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer test-firebase-token");
    expect(b.track.stop).toHaveBeenCalledOnce(); expect(b.closePeer).toHaveBeenCalledOnce(); expect(b.closeChannel).toHaveBeenCalledOnce(); expect(b.pause).toHaveBeenCalledOnce();
    expect(b.send).toHaveBeenCalledWith(JSON.stringify({ type: "session.close" }));
  });
  it("stops a late microphone after hang-up while the permission prompt is open", async () => {
    const b = browser(), abort = new AbortController();
    let grant!: (value: unknown) => void;
    b.media.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const call = startVoiceCall(input, vi.fn(), abort.signal, vi.fn(), vi.fn());
    await vi.waitFor(() => expect(b.media).toHaveBeenCalled());
    abort.abort();
    await expect(call).rejects.toThrow();
    grant(b.microphone);
    await vi.waitFor(() => expect(b.track.stop).toHaveBeenCalled());
    expect(b.track.stop).toHaveBeenCalled(); expect(b.closePeer).toHaveBeenCalledOnce();
  });
  it("reports blocked microphones and HTTP failures without a demo fallback", async () => {
    const b = browser();
    b.media.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await expect(startVoiceCall(input, vi.fn(), new AbortController().signal, vi.fn(), vi.fn())).rejects.toThrow("Microphone access is blocked");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Sign in required." }), { status: 401 })));
    await expect(startVoiceCall(input, vi.fn(), new AbortController().signal, vi.fn(), vi.fn())).rejects.toThrow("Sign in required");
    expect(b.track.stop).toHaveBeenCalledOnce();
  });
});

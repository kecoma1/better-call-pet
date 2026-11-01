import { describe, expect, it } from "vitest";
import { mergeCallCaption, voiceEventSchema } from "../src/lib/voice";
import { readTranscript, liveDelegationId, liveResultChunks } from "../functions/src/voice-protocol";

describe("voice transcript boundaries", () => {
  it("groups each speaker independently and starts a new turn after a pause", () => {
    let captions = mergeCallCaption([], { role: "user", text: "How many", startMs: 0, endMs: 100 });
    captions = mergeCallCaption(captions, { role: "assistant", text: "Let me check.", startMs: 50, endMs: 150 });
    captions = mergeCallCaption(captions, { role: "user", text: " receipts?", startMs: 100, endMs: 300 });
    captions = mergeCallCaption(captions, { role: "user", text: "And invoices?", startMs: 2000, endMs: 2500 });
    expect(captions.map((c) => c.text)).toEqual(["How many receipts?", "Let me check.", "And invoices?"]);
  });
  it("rejects malformed captions and untrusted delegation shapes", () => {
    expect(readTranscript({ type: "session.input_transcript.delta", delta: "Hi", start_ms: 100, end_ms: 0 })).toBeNull();
    expect(readTranscript({ type: "session.input_transcript.delta", delta: "Hi", start_ms: 0, end_ms: 1 })).toEqual({ role: "user", text: "Hi", startMs: 0, endMs: 1 });
    expect(voiceEventSchema.safeParse({ type: "connected", sdp: null }).success).toBe(false);
    expect(voiceEventSchema.safeParse({ type: "transcript", role: "system", text: "Hi", startMs: 0, endMs: 1 }).success).toBe(false);
    expect(liveDelegationId({ type: "session.delegation.created", delegation: { id: "valid", target: "responses" } })).toBeNull();
    expect(liveDelegationId({ type: "session.delegation.created", delegation: { id: "valid", target: "client" } })).toBe("valid");
  });
  it("chunks multilingual backend results without splitting characters", () => {
    const text = "Factura £100.00, información 日本語. ".repeat(80);
    const chunks = liveResultChunks(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((c) => Buffer.byteLength(c) <= 450 && !c.includes("�"))).toBe(true);
    expect(liveResultChunks("")).toEqual([]);
  });
});

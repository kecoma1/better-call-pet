import { captionSchema, type CallCaption } from "../../src/lib/voice.js";

export type LiveEvent = Record<string, unknown> & { type: string };
export function readLiveEvent(value: unknown): LiveEvent | null {
  if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") return null;
  return value as LiveEvent;
}
export function readTranscript(event: LiveEvent): CallCaption | null {
  const role = event.type === "session.input_transcript.delta" ? "user"
    : event.type === "session.output_transcript.delta" ? "assistant" : null;
  if (!role) return null;
  const result = captionSchema.safeParse({ role, text: event.delta, startMs: event.start_ms, endMs: event.end_ms });
  return result.success ? result.data : null;
}
export function liveUsageSeconds(event: LiveEvent): number | null {
  const usage = event.usage as { seconds?: unknown } | undefined;
  return typeof usage?.seconds === "number" && Number.isFinite(usage.seconds) && usage.seconds >= 0 ? usage.seconds : null;
}
export function liveDelegationId(event: LiveEvent): string | null {
  const d = event.delegation as { id?: unknown; target?: unknown } | undefined;
  return event.type === "session.delegation.created" && d?.target === "client" && typeof d.id === "string"
    && /^[a-zA-Z0-9_-]{1,128}$/.test(d.id) ? d.id : null;
}
// Conservative UTF-8 bounds keep context appends below the provider token limit.
export function liveResultChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.slice(0, 16000);
  while (remaining) {
    const chunk = Buffer.from(remaining).subarray(0, 450).toString("utf8").replace(/\uFFFD$/, "");
    chunks.push(chunk);
    remaining = remaining.slice(chunk.length);
  }
  return chunks;
}

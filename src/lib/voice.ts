import { z } from "zod";
import { toolSchema } from "./chat-schema.js";
import type { ChatMessage } from "../domain.js";

export const captionSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
  startMs: z.number().finite().nonnegative(),
  endMs: z.number().finite().nonnegative(),
}).refine((v) => v.endMs >= v.startMs);
export type CallCaption = z.infer<typeof captionSchema>;
export const voiceEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connected"), sdp: z.string().min(1).max(100000) }),
  z.object({ type: z.literal("transcript"), ...captionSchema.shape }).refine((v) => v.endMs >= v.startMs),
  z.object({ type: z.enum(["working", "listening", "ended"]) }),
  z.object({ type: z.literal("tool"), id: z.string().min(1).max(160), tool: toolSchema }),
  z.object({ type: z.literal("error"), message: z.string().max(500) }),
]);
export type VoiceEvent = z.infer<typeof voiceEventSchema>;
export type CallEntry = Extract<VoiceEvent, { type: "transcript" | "tool" }>;

export function mergeCallEntry(previous: CallEntry[], event: CallEntry): CallEntry[] {
  if (event.type === "tool") {
    return previous.some((entry) => entry.type === "tool" && entry.id === event.id)
      ? previous : [...previous, event];
  }
  const priorCaption = [...previous].reverse().find((entry) => entry.type === "transcript" && entry.role === event.role);
  const index = priorCaption ? previous.indexOf(priorCaption) : -1;
  const prior = previous[index];
  if (prior?.type === "transcript") {
    const merged = mergeCallCaption([prior], event);
    if (merged.length === 1) return previous.map((entry, i) => i === index ? { type: "transcript", ...merged[0] } : entry);
  }
  return [...previous, event];
}

export function callMessages(entries: CallEntry[]): ChatMessage[] {
  return entries.map((entry) => entry.type === "tool"
    ? { role: "assistant", content: "", tools: [entry.tool] }
    : { role: entry.role, content: entry.text });
}

// Live fragments from each speaker can overlap. Keep their turns independent.
export function mergeCallCaption(previous: CallCaption[], fragment: CallCaption): CallCaption[] {
  const captions = previous.map((caption) => ({ ...caption }));
  const prior = [...captions].reverse().find((caption) => caption.role === fragment.role);
  if (prior && fragment.startMs >= prior.startMs && fragment.startMs - prior.endMs <= 1500) {
    prior.text += fragment.text;
    prior.endMs = Math.max(prior.endMs, fragment.endMs);
  } else captions.push({ ...fragment });
  return captions.sort((a, b) => a.startMs - b.startMs);
}

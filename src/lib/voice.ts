import { z } from "zod";

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
  z.object({ type: z.literal("error"), message: z.string().max(500) }),
]);
export type VoiceEvent = z.infer<typeof voiceEventSchema>;

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

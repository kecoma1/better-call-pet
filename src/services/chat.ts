import { z } from "zod";
import { api } from "./api";
import { toolSchema } from "../lib/chat-schema";
export { toolSchema } from "../lib/chat-schema";
import {
  chatEventKinds,
  conversationTopics,
  type Conversation,
} from "../domain";

export const chatEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  kind: z.enum(chatEventKinds),
  at: z.iso.datetime(),
  tool: toolSchema.shape.name.optional(),
  topic: z.enum(conversationTopics).optional(),
});
export const chatRunSchema = z.object({
  requestId: z.uuid(),
  conversationId: z.uuid(),
  createdBy: z.string().min(1),
  status: z.enum(["running", "completed", "failed"]),
  updatedAt: z.iso.datetime(),
  content: z.string().max(10000),
  tools: z.array(toolSchema).max(12),
  events: z.array(chatEventSchema).max(80),
});
export const conversationSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.enum(conversationTopics),
  preview: z.string(),
  updatedAt: z.iso.datetime(),
  provider: z.enum(["demo-rules", "openai-decisions"]),
});
export const conversationSchema = conversationSummarySchema.extend({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
      tools: z.array(toolSchema).optional(),
      activity: z.array(chatEventSchema).max(80).optional(),
    }),
  ),
});
export async function fetchConversations(signal?: AbortSignal) {
  const result = z
    .array(conversationSummarySchema)
    .safeParse(await api("/conversations", undefined, signal));
  if (!result.success)
    throw Error("Could not load conversations. Please try again.");
  return result.data;
}
export async function fetchConversation(
  id: string,
  signal?: AbortSignal,
): Promise<Conversation> {
  const result = conversationSchema.safeParse(
    await api("/conversations/" + encodeURIComponent(id), undefined, signal),
  );
  if (!result.success || result.data.id !== id)
    throw Error("Could not open this conversation. Please try again.");
  return result.data;
}
export async function sendConversationMessage(
  conversationId: string,
  message: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<Conversation> {
  const result = z
    .object({ conversation: conversationSchema })
    .safeParse(
      await api("/chat", { conversationId, message, requestId }, signal),
    );
  if (!result.success || result.data.conversation.id !== conversationId)
    throw Error("Saul could not finish his reply. Please try again.");
  return result.data.conversation;
}

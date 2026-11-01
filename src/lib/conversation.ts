import { z } from "zod";

export const conversationSchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(5000),
})).max(100);
export type ChatMessage = z.infer<typeof conversationSchema>[number];
export const welcomeConversation: ChatMessage[] = [{
  role: "assistant",
  content: "Hey, I’m Saul. You handle the business. I’ll help with the fine print. What are we looking at?",
}];
export const recentConversation = (messages: ChatMessage[]) =>
  conversationSchema.parse(messages.slice(-100).map((m) => ({ ...m, content: m.content.slice(-5000) })));

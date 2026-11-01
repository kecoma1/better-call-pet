import { replyToConversation } from "./chat.js";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runSaul(uid: string, messages: ChatMessage[], signal?: AbortSignal) {
  return (await replyToConversation(uid, messages, undefined, signal)).content;
}

import { replyToConversation } from "./chat.js";
import type { ChatToolResult } from "../../src/domain.js";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function runSaul(uid: string, messages: ChatMessage[], signal?: AbortSignal, onTool?: (result: ChatToolResult) => void) {
  return (await replyToConversation(uid, messages, undefined, signal, onTool)).content;
}

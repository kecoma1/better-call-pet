import { api } from "./api";
import { conversationSchema, recentConversation, type ChatMessage } from "../lib/conversation";

export async function fetchConversation(live: boolean, signal?: AbortSignal): Promise<ChatMessage[]> {
  let data: unknown;
  if (live) data = await api("/conversation", undefined, signal);
  else {
    try { data = JSON.parse(localStorage.getItem("bcp-offline-conversation-v1") || "[]"); }
    catch { throw Error("The saved conversation could not be read."); }
  }
  signal?.throwIfAborted();
  const parsed = conversationSchema.safeParse(data);
  if (!parsed.success) throw Error("The saved conversation could not be read.");
  return parsed.data;
}
export async function saveConversation(messages: ChatMessage[], live: boolean, signal?: AbortSignal) {
  const data = recentConversation(messages);
  signal?.throwIfAborted();
  if (live) await api("/conversation", { messages: data }, signal);
  else {
    try { localStorage.setItem("bcp-offline-conversation-v1", JSON.stringify(data)); }
    catch { throw Error("The conversation could not be saved in this browser."); }
  }
}

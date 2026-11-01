import { conversationSchema, type ChatMessage } from "../../src/lib/conversation.js";
import { actorUid, workspaceDocument, type WorkspaceActor } from "./workspace-context.js";

const ref = (actor: WorkspaceActor) => workspaceDocument("conversations", actorUid(actor), actor);
export async function readConversation(actor: WorkspaceActor): Promise<ChatMessage[]> {
  const data = (await ref(actor).get()).data();
  return conversationSchema.parse(data?.messages || []);
}
export async function writeConversation(actor: WorkspaceActor, messages: ChatMessage[]) {
  await ref(actor).set({ messages: conversationSchema.parse(messages) });
}

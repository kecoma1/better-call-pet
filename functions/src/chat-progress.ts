import { getFirestore } from "firebase-admin/firestore";
import type { ChatEvent, ChatRun, ChatToolResult } from "../../src/domain.js";

type EventInput = Omit<ChatEvent, "sequence" | "at">;
export function initialChatRun(
  uid: string,
  conversationId: string,
  requestId: string,
): ChatRun {
  return {
    createdBy: uid,
    conversationId,
    requestId,
    status: "running",
    updatedAt: new Date().toISOString(),
    content: "",
    tools: [],
    events: [],
  };
}

export function chatProgress(initial: ChatRun, attemptId: string) {
  const db = getFirestore();
  const ref = db.collection("chatRuns").doc(initial.requestId);
  const state: ChatRun = structuredClone(initial);
  let writes = Promise.resolve();
  let lastFlush = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  function close() {
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function flush() {
    state.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(state);
    writes = writes
      .catch(() => {})
      .then(() =>
        db.runTransaction(async (tx) => {
          const current = (await tx.get(ref)).data();
          if (current?.attemptId !== attemptId)
            throw Error("This chat run was replaced. Reopen the conversation.");
          tx.update(ref, { ...snapshot });
        }),
      );
    lastFlush = Date.now();
    return writes;
  }
  async function event(event: EventInput) {
    if (closed) return;
    if (state.events.length >= 79)
      throw Error(
        "Saul reached the activity limit. Please try a shorter request.",
      );
    state.events.push({
      ...event,
      sequence: state.events.length,
      at: new Date().toISOString(),
    });
    await flush();
  }
  return {
    get events() {
      return structuredClone(state.events);
    },
    event,
    async text(delta: string) {
      if (closed) return;
      if (state.content.length + delta.length > 10000)
        throw Error("Saul’s reply is too long. Please try a shorter request.");
      const first = state.content.length === 0;
      state.content += delta;
      if (first || Date.now() - lastFlush >= 250) {
        if (timer) clearTimeout(timer);
        timer = null;
        await flush();
      } else if (!timer) {
        // As in Goals Tracker's ThinkingWriter: publish the trailing update even
        // when the model pauses, and cancel it before the final state is saved.
        timer = setTimeout(
          () => {
            timer = null;
            if (!closed) void flush().catch(() => {});
          },
          Math.max(0, 250 - (Date.now() - lastFlush)),
        );
      }
    },
    async tool(result: ChatToolResult) {
      if (closed) return;
      if (state.tools.length < 12) state.tools.push(result);
      await event({ kind: "tool_completed", tool: result.name });
    },
    completion() {
      return [
        ...state.events,
        {
          sequence: state.events.length,
          kind: "completed" as const,
          at: new Date().toISOString(),
        },
      ];
    },
    async complete(content: string, events: ChatEvent[]) {
      close();
      state.status = "completed";
      state.content = content;
      state.events = events;
      await flush();
    },
    async fail() {
      close();
      state.status = "failed";
      state.events = [
        ...state.events.slice(0, 79),
        {
          sequence: Math.min(state.events.length, 79),
          kind: "failed",
          at: new Date().toISOString(),
        },
      ];
      await flush();
    },
  };
}
export type ChatProgress = ReturnType<typeof chatProgress>;

import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  run: vi.fn(),
  quota: vi.fn(),
  tools: [] as any[],
}));
vi.mock("firebase-admin/firestore", () => {
  const ref = (key: string) => ({
    key,
    get: async () => ({ data: () => state.docs.get(key) }),
  });
  return {
    getFirestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ref(`${name}/${id}`),
        where: (_field: string, _op: string, uid: string) => ({
          get: async () => ({
            docs: [...state.docs.entries()]
              .filter(
                ([key, value]) =>
                  key.startsWith(name + "/") && value.createdBy === uid,
              )
              .map(([, data]) => ({ data: () => data })),
          }),
        }),
      }),
      runTransaction: async (fn: any) =>
        fn({
          get: async (r: any) => ({ data: () => state.docs.get(r.key) }),
          set: (r: any, data: any) => state.docs.set(r.key, data),
          update: (r: any, data: any) =>
            state.docs.set(r.key, { ...state.docs.get(r.key), ...data }),
          delete: (r: any) => state.docs.delete(r.key),
        }),
    }),
  };
});
vi.mock("../src/tools", () => ({
  aiQuota: state.quota,
  sharedTools: () => state.tools,
}));
vi.mock("@openai/agents", () => ({
  Agent: class {
    constructor(public options: any) {}
  },
  run: state.run,
  tool: (options: any) => options,
}));
import {
  classifyConversation,
  getConversation,
  listConversations,
  presentToolResult,
  replyToConversation,
  sendConversationMessage,
} from "../src/chat";
import {
  conversationTopics,
  defaultCompany,
  demoReceipts,
} from "../../src/domain";
const id = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const request = {
  conversationId: id,
  requestId,
  message: "What VAT can I reclaim?",
};
function decision(topic = "VAT") {
  return new Response(
    JSON.stringify({
      id: "decision-test",
      answers: [{ name: "conversation_topic", type: "choice", choice: topic }],
    }),
  );
}
beforeEach(() => {
  state.docs.clear();
  state.run.mockReset().mockResolvedValue({
    finalOutput: "Check your invoice evidence before claiming VAT.",
    completed: Promise.resolve(),
    async *[Symbol.asyncIterator]() {
      yield {
        type: "raw_model_stream_event",
        data: {
          type: "output_text_delta",
          delta: "Check your invoice evidence before claiming VAT.",
        },
      };
    },
  });
  state.quota.mockReset().mockResolvedValue(undefined);
  state.tools = [];
  process.env.OPENAI_API_KEY = "test-only-key";
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision());
});
describe("conversation classification and persistence", () => {
  it.each(conversationTopics)(
    "accepts Decisions topic %s with the required model and fixed choices",
    async (topic) => {
      vi.mocked(fetch).mockResolvedValueOnce(decision(topic));
      expect(
        await classifyConversation([
          { role: "user", content: request.message },
        ]),
      ).toMatchObject({ topic, decisionId: "decision-test" });
      const body = JSON.parse(
        vi.mocked(fetch).mock.calls[0][1]!.body as string,
      );
      expect(body.model).toBe("gpt-6-luna");
      expect(body.questions[0].choices.map((c: any) => c.value)).toEqual([
        ...conversationTopics,
      ]);
    },
  );
  it.each([
    {},
    { answers: [] },
    { answers: [{ name: "conversation_topic", type: "refusal" }] },
    {
      answers: [
        { name: "conversation_topic", type: "choice", choice: "Payroll" },
      ],
    },
  ])("rejects unusable Decisions output", async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(body)));
    await expect(sendConversationMessage("member", request)).rejects.toThrow(
      "usable conversation topic",
    );
    expect(
      [...state.docs.keys()].filter((key: string) =>
        key.startsWith("conversations/"),
      ),
    ).toHaveLength(0);
    expect(state.run).not.toHaveBeenCalled();
  });
  it("saves a classified turn once, strips private metadata and reuses a completed retry", async () => {
    const saved = await sendConversationMessage("member", request);
    expect(saved.topic).toBe("VAT");
    expect(saved.messages).toHaveLength(2);
    expect(saved).not.toHaveProperty("createdBy");
    expect(saved).not.toHaveProperty("pendingUntil");
    expect(await sendConversationMessage("member", request)).toEqual(saved);
    expect(state.run).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(
      sendConversationMessage("member", {
        ...request,
        message: "Different intent",
      }),
    ).rejects.toThrow("different message");
  });
  it("uses saved history and updates the topic when the user's intent changes", async () => {
    const first = await sendConversationMessage("member", request);
    vi.mocked(fetch).mockResolvedValueOnce(decision("Annual accounts"));
    const next = await sendConversationMessage("member", {
      ...request,
      requestId: crypto.randomUUID(),
      message: "Now help with year-end accounts",
    });
    expect(next.topic).toBe("Annual accounts");
    expect(next.title).toBe(first.title);
    expect(next.messages).toHaveLength(4);
    const context = state.run.mock.calls[1][1];
    expect(context[0].content).toBe(request.message);
    expect(context.at(-1).content).toBe("Now help with year-end accounts");
  });
  it("never substitutes demo routing or invokes tools after a failed Decisions call", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(sendConversationMessage("member", request)).rejects.toThrow(
      "could not classify",
    );
    expect(
      [...state.docs.keys()].filter((key: string) =>
        key.startsWith("conversations/"),
      ),
    ).toHaveLength(0);
    expect(state.run).not.toHaveBeenCalled();
  });
  it("releases a failed agent turn and keeps the previous completed history", async () => {
    const first = await sendConversationMessage("member", request);
    state.run.mockRejectedValueOnce(Error("Agent unavailable"));
    await expect(
      sendConversationMessage("member", {
        ...request,
        requestId: crypto.randomUUID(),
        message: "More detail",
      }),
    ).rejects.toThrow("could not finish");
    expect(await getConversation("member", id)).toEqual(first);
    expect(state.docs.get("conversations/" + id).pendingRequestId).toBeNull();
  });
  it("recovers an expired lease without losing completed history", async () => {
    await sendConversationMessage("member", request);
    Object.assign(state.docs.get("conversations/" + id), {
      pendingRequestId: "expired",
      pendingUntil: Date.now() - 1,
    });
    const saved = await sendConversationMessage("member", {
      ...request,
      requestId: crypto.randomUUID(),
      message: "More detail",
    });
    expect(saved.messages).toHaveLength(4);
  });
  it("bounds stored conversations before invoking providers", async () => {
    await sendConversationMessage("member", request);
    const saved = state.docs.get("conversations/" + id);
    saved.messages = Array.from({ length: 60 }, () => ({
      role: "user",
      content: "Example",
    }));
    await expect(
      sendConversationMessage("member", {
        ...request,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Start a new conversation");
    saved.messages = [{ role: "user", content: "x".repeat(600001) }];
    await expect(
      sendConversationMessage("member", {
        ...request,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Start a new conversation");
    expect(state.run).toHaveBeenCalledTimes(1);
  });
  it("retains old text and tool pills while bounding card snapshots", async () => {
    await sendConversationMessage("member", request);
    const saved = state.docs.get("conversations/" + id);
    saved.messages = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: "Example",
      ...(index % 2
        ? { tools: [presentToolResult("list_receipts", demoReceipts)] }
        : {}),
    }));
    const next = await sendConversationMessage("member", {
      ...request,
      requestId: crypto.randomUUID(),
      message: "Continue",
    });
    expect(next.messages).toHaveLength(14);
    expect(next.messages[1].tools?.[0]).toEqual({
      name: "list_receipts",
      receiptCount: 3,
    });
    expect(next.messages[11].tools?.[0].receipts).toHaveLength(3);
  });
  it("rejects another member's conversation, unknown IDs and concurrent sends", async () => {
    await sendConversationMessage("member", request);
    await expect(getConversation("outsider", id)).rejects.toThrow(
      "Conversation not found",
    );
    await expect(
      getConversation("member", crypto.randomUUID()),
    ).rejects.toThrow("Conversation not found");
    await expect(
      sendConversationMessage("outsider", {
        ...request,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("Conversation not found");
    state.docs.get("conversations/" + id).pendingUntil = Date.now() + 60000;
    await expect(
      sendConversationMessage("member", {
        ...request,
        requestId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("already replying");
    expect(state.run).toHaveBeenCalledTimes(1);
  });
  it("lists only the actor's completed conversations, newest first, without messages", async () => {
    await sendConversationMessage("member", request);
    const data = state.docs.get("conversations/" + id);
    state.docs.set("conversations/other", {
      ...data,
      id: "other",
      createdBy: "other",
    });
    state.docs.set("conversations/pending", {
      createdBy: "member",
      messages: [],
    });
    state.docs.set("conversations/newer", {
      ...data,
      id: "newer",
      updatedAt: "2027-01-01T00:00:00.000Z",
    });
    const list = await listConversations("member");
    expect(list.map((c) => c.id)).toEqual(["newer", id]);
    expect(list[0]).not.toHaveProperty("messages");
    expect(list[0]).not.toHaveProperty("createdBy");
  });
  it("rejects forged history, topic, empty text and invalid identifiers before a provider request", async () => {
    for (const bad of [
      { ...request, topic: "Receipts" },
      { ...request, messages: [] },
      { ...request, message: " " },
      { ...request, message: "x".repeat(5001) },
      { ...request, conversationId: "other/path" },
    ]) {
      await expect(sendConversationMessage("member", bad)).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(
      [...state.docs.keys()].filter((key: string) =>
        key.startsWith("conversations/"),
      ),
    ).toHaveLength(0);
  });
  it("applies the AI quota and fails without creating a conversation when unavailable", async () => {
    state.quota.mockRejectedValueOnce(Error("Daily AI limit reached"));
    await expect(sendConversationMessage("member", request)).rejects.toThrow(
      "Daily AI limit",
    );
    expect(
      [...state.docs.keys()].filter((key: string) =>
        key.startsWith("conversations/"),
      ),
    ).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    delete process.env.OPENAI_API_KEY;
    await expect(
      classifyConversation([{ role: "user", content: "Hello" }]),
    ).rejects.toThrow("not configured");
  });
});
describe("deterministic cards and actual tool activity", () => {
  it("renders data only for tools actually executed through sharedTools", async () => {
    state.tools = [
      {
        name: "list_receipts",
        description: "List receipts",
        schema: {},
        execute: async () => demoReceipts,
      },
    ];
    state.run.mockImplementationOnce(async (agent) => {
      await agent.options.tools[0].execute({});
      return { finalOutput: "Here are your receipts." };
    });
    const reply = await replyToConversation("member", [
      { role: "user", content: "List receipts" },
    ]);
    expect(reply.tools?.[0].name).toBe("list_receipts");
    expect(reply.tools?.[0].receipts).toHaveLength(3);
    expect(reply.tools?.[0].receipts?.[0]).not.toHaveProperty("notes");
    expect(reply.tools?.[0].receipts?.[0]).not.toHaveProperty("decision");
    expect((await replyToConversation("member", [])).tools).toBeUndefined();
  });
  it("keeps invoice snapshots bounded, includes total counts and strips company identifiers", () => {
    const result = presentToolResult(
      "list_receipts",
      Array.from({ length: 50 }, () => demoReceipts[0]),
    );
    expect(result.receipts).toHaveLength(20);
    expect(result.receiptCount).toBe(50);
    expect(
      presentToolResult("create_receipt", demoReceipts[0]).receipts,
    ).toHaveLength(1);
    const company = presentToolResult("get_company", defaultCompany).company;
    expect(company?.name).toBe(defaultCompany.name);
    expect(company).not.toHaveProperty("utr");
    expect(presentToolResult("save_company", defaultCompany).company).toEqual(
      company,
    );
  });
  it("rejects empty agent output instead of saving a fabricated reply", async () => {
    state.run.mockResolvedValueOnce({ finalOutput: " " });
    await expect(sendConversationMessage("member", request)).rejects.toThrow(
      "could not finish",
    );
    expect(
      [...state.docs.keys()].filter((key: string) =>
        key.startsWith("conversations/"),
      ),
    ).toHaveLength(0);
  });
});

describe("persisted live chat runs", () => {
  it("publishes real tool events and partial text before the HTTP operation finishes", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    state.tools = [
      {
        name: "get_company",
        description: "Company",
        schema: {},
        execute: async () => defaultCompany,
      },
    ];
    state.run.mockImplementationOnce(async (agent) => ({
      finalOutput: "First part. Final part.",
      completed: Promise.resolve(),
      async *[Symbol.asyncIterator]() {
        await agent.options.tools[0].execute({});
        yield {
          type: "raw_model_stream_event",
          data: { type: "output_text_delta", delta: "First part." },
        };
        await gate;
        yield {
          type: "raw_model_stream_event",
          data: { type: "output_text_delta", delta: " Final part." },
        };
      },
    }));
    let finished = false;
    const response = sendConversationMessage("member", request).then(
      (value) => {
        finished = true;
        return value;
      },
    );
    await vi.waitFor(() =>
      expect(state.docs.get("chatRuns/" + requestId)?.content).toBe(
        "First part.",
      ),
    );
    expect(finished).toBe(false);
    const partial = state.docs.get("chatRuns/" + requestId);
    expect(partial.createdBy).toBe("member");
    expect(partial.tools[0].company.name).toBe(defaultCompany.name);
    expect(partial.events.map((event: any) => event.kind)).toEqual([
      "classifying",
      "classified",
      "tool_started",
      "tool_completed",
      "responding",
    ]);
    finish();
    const saved = await response;
    expect(saved.messages.at(-1)!.activity!.at(-1)!.kind).toBe("completed");
    expect(state.docs.get("chatRuns/" + requestId).status).toBe("completed");
    expect(state.docs.get("chatRuns/" + requestId).content).toBe(
      "First part. Final part.",
    );
  });
  it("marks failed runs and rejects request-ID reuse across members or conversations", async () => {
    state.quota.mockRejectedValueOnce(Error("Quota exhausted"));
    await expect(sendConversationMessage("member", request)).rejects.toThrow(
      "Quota exhausted",
    );
    const failed = state.docs.get("chatRuns/" + requestId);
    expect(failed.status).toBe("failed");
    expect(failed.events.at(-1).kind).toBe("failed");
    await expect(
      sendConversationMessage("other", {
        ...request,
        conversationId: crypto.randomUUID(),
      }),
    ).rejects.toThrow("different message");
    expect(state.docs.get("chatRuns/" + requestId).createdBy).toBe("member");
  });
});

describe("bounded progress writer", () => {
  it("flushes trailing text and fences delayed updates before completion", async () => {
    const { chatProgress, initialChatRun } = await import("../src/chat-progress");
    const initial = initialChatRun("member", id, requestId);
    state.docs.set("chatRuns/" + requestId, { ...initial, attemptId: "attempt" });
    const progress = chatProgress(initial, "attempt");
    await progress.text("First");
    await progress.text(" trailing");
    await vi.waitFor(() => expect(state.docs.get("chatRuns/" + requestId).content).toBe("First trailing"));
    await progress.text(" final");
    await progress.complete("Final reply", progress.completion());
    await progress.text(" obsolete");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(state.docs.get("chatRuns/" + requestId).content).toBe("Final reply");
    expect(state.docs.get("chatRuns/" + requestId).status).toBe("completed");
  });
  it("rejects oversized text and a writer from a replaced attempt", async () => {
    const { chatProgress, initialChatRun } = await import("../src/chat-progress");
    const initial = initialChatRun("member", id, requestId);
    state.docs.set("chatRuns/" + requestId, { ...initial, attemptId: "new-attempt" });
    const progress = chatProgress(initial, "old-attempt");
    await expect(progress.text("x".repeat(10001))).rejects.toThrow("too long");
    await expect(progress.event({ kind: "classifying" })).rejects.toThrow("replaced");
    expect(state.docs.get("chatRuns/" + requestId).events).toEqual([]);
  });
});

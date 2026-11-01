import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
import {
  fetchConversation,
  fetchConversations,
  sendConversationMessage,
} from "../src/services/chat";
const conversation = {
  id: "test",
  title: "VAT question",
  topic: "VAT",
  preview: "A reply",
  updatedAt: "2026-11-01T12:00:00.000Z",
  provider: "openai-decisions",
  messages: [{ role: "assistant", content: "A reply" }],
};
beforeEach(() => {
  vi.mocked(api).mockReset();
});
describe("chat service boundaries", () => {
  it("validates lists and forwards abort signals", async () => {
    const signal = new AbortController().signal;
    vi.mocked(api).mockResolvedValueOnce([conversation]);
    expect(await fetchConversations(signal)).toHaveLength(1);
    expect(api).toHaveBeenCalledWith("/conversations", undefined, signal);
  });
  it("opens the requested record and checks its identity", async () => {
    vi.mocked(api).mockResolvedValue(conversation);
    expect((await fetchConversation("test")).topic).toBe("VAT");
    await expect(fetchConversation("different")).rejects.toThrow(
      "Could not open",
    );
  });
  it("sends only message text and server-validated request identifiers", async () => {
    vi.mocked(api).mockResolvedValueOnce({ conversation });
    expect(await sendConversationMessage("test", "Hello", "request")).toEqual(
      conversation,
    );
    expect(api).toHaveBeenCalledWith(
      "/chat",
      { conversationId: "test", message: "Hello", requestId: "request" },
      undefined,
    );
  });
  it.each([
    null,
    {},
    [{ ...conversation, topic: "Other" }],
    [{ ...conversation, updatedAt: "yesterday" }],
  ])("rejects malformed conversation lists", async (data) => {
    vi.mocked(api).mockResolvedValue(data);
    await expect(fetchConversations()).rejects.toThrow("Could not load");
  });
  it("rejects malformed tools and monetary values at the boundary", async () => {
    vi.mocked(api).mockResolvedValue({
      ...conversation,
      messages: [
        {
          role: "assistant",
          content: "Hi",
          tools: [
            {
              name: "list_receipts",
              receipts: [
                {
                  id: "1",
                  vendor: "Test",
                  netPence: 1.25,
                  vatPence: 0,
                  status: "posted",
                },
              ],
            },
          ],
        },
      ],
    });
    await expect(fetchConversation("test")).rejects.toThrow("Could not open");
    vi.mocked(api).mockResolvedValue({});
    await expect(
      sendConversationMessage("test", "Hello", "request"),
    ).rejects.toThrow("could not finish");
  });
  it("propagates authentication and provider failures without fallback", async () => {
    vi.mocked(api).mockRejectedValue(Error("Decisions unavailable"));
    await expect(
      sendConversationMessage("test", "Hello", "request"),
    ).rejects.toThrow("Decisions unavailable");
  });
});

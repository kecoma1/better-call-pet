import { describe, it, expect, vi } from "vitest";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
import { fetchConversation, saveConversation } from "../src/services/conversation";
import { conversationSchema, recentConversation } from "../src/lib/conversation";
const messages = [{ role: "user" as const, content: "What needs attention?" }];

describe("persistent conversations", () => {
  it("restores local chat and bounds the saved history", async () => {
    expect(await fetchConversation(false)).toEqual([]);
    await saveConversation(messages, false);
    expect(await fetchConversation(false)).toEqual(messages);
    const recent = recentConversation(Array.from({ length: 101 }, (_, i) => ({ role: "user", content: String(i) })));
    expect(recent).toHaveLength(100);
    expect(recent[0].content).toBe("1");
    expect(conversationSchema.safeParse([{ role: "system", content: "Untrusted" }]).success).toBe(false);
    expect(conversationSchema.safeParse([{ role: "user", content: "" }]).success).toBe(false);
  });
  it("uses the authenticated API for anonymous and internal sessions, including cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(api).mockResolvedValue(messages);
    expect(await fetchConversation(true, controller.signal)).toEqual(messages);
    expect(api).toHaveBeenCalledWith("/conversation", undefined, controller.signal);
    await saveConversation(messages, true, controller.signal);
    expect(api).toHaveBeenCalledWith("/conversation", { messages }, controller.signal);
    controller.abort();
    await expect(saveConversation(messages, true, controller.signal)).rejects.toThrow();
  });
  it("reports corrupt storage and save failures without inventing or replacing messages", async () => {
    vi.mocked(api).mockResolvedValue({ wrong: true });
    await expect(fetchConversation(true)).rejects.toThrow("could not be read");
    vi.mocked(api).mockRejectedValue(Error("Server unavailable"));
    await expect(saveConversation(messages, true)).rejects.toThrow("Server unavailable");
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw Error("Quota"); });
    await expect(saveConversation(messages, false)).rejects.toThrow("could not be saved");
  });
});

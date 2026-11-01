import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
vi.mock("../src/services/chat", () => ({ fetchConversations: vi.fn(), fetchConversation: vi.fn(), sendConversationMessage: vi.fn() }));
vi.mock("../src/services/chat-events", () => ({ watchChatRun: () => () => {} }));
vi.mock("../src/firebase", () => ({ currentWorkspaceUser: () => null }));
import * as service from "../src/services/chat";
import Chat from "../src/components/chat";
import type { Conversation } from "../src/domain";
let saved: Conversation;
beforeEach(() => {
  saved = { id: "11111111-1111-4111-8111-111111111111", title: "Earlier question", topic: "Bookkeeping", preview: "Earlier saved answer", updatedAt: "2026-11-01T12:00:00.000Z", provider: "openai-decisions", messages: [{ role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier saved answer" }] };
  vi.mocked(service.fetchConversations).mockReset().mockImplementation(async () => [saved]);
  vi.mocked(service.fetchConversation).mockReset().mockImplementation(async () => saved);
  vi.mocked(service.sendConversationMessage).mockReset().mockImplementation(async (_id, message) => {
    saved = { ...saved, messages: [...saved.messages, { role: "user", content: message }, { role: "assistant", content: "New live answer" }] };
    return saved;
  });
});
async function openHistory() {
  const history = screen.getByRole("navigation", { name: "Conversation history" });
  fireEvent.click(await within(history).findByRole("button", { name: /Earlier question/ }));
  await waitFor(() => expect(screen.getByLabelText("Message Saul")).toBeEnabled());
}
function send(message: string) {
  fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: message } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
describe("saved real AI conversations", () => {
  it("restores server history and resumes saved replies after remounting", async () => {
    const mounted = render(<Chat live view="page" items={[]} onRefresh={vi.fn()} />);
    await openHistory();
    expect(screen.getByRole("article", { name: "Saul’s reply" })).toHaveTextContent("Earlier saved answer");
    send("Next question");
    await waitFor(() => expect(saved.messages.at(-1)?.content).toBe("New live answer"));
    mounted.unmount();
    render(<Chat live view="page" items={[]} onRefresh={vi.fn()} />);
    await openHistory();
    expect(screen.getAllByRole("article", { name: "Your message" }).at(-1)).toHaveTextContent("Next question");
    expect(screen.getAllByRole("article", { name: "Saul’s reply" }).at(-1)).toHaveTextContent("New live answer");
  });
  it("keeps history failures visible and retries the server without a fabricated replacement", async () => {
    vi.mocked(service.fetchConversations).mockRejectedValueOnce(Error("History unavailable"));
    render(<Chat live view="page" items={[]} onRefresh={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("History unavailable");
    expect(service.sendConversationMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh conversations" }));
    await openHistory();
    expect(screen.getByRole("article", { name: "Saul’s reply" })).toHaveTextContent("Earlier saved answer");
  });
  it("retains a failed question for retry and preserves completed history", async () => {
    vi.mocked(service.sendConversationMessage).mockRejectedValueOnce(Error("Provider unavailable"));
    render(<Chat live view="page" items={[]} onRefresh={vi.fn()} />);
    await openHistory(); send("Keep this question");
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider unavailable");
    expect(screen.getByLabelText("Message Saul")).toHaveValue("Keep this question");
    expect(saved.messages).toHaveLength(2);
    expect(screen.queryByText(/This is the demo workspace/)).not.toBeInTheDocument();
  });
  it("does not call the provider or replace saved messages when opening history fails", async () => {
    vi.mocked(service.fetchConversation).mockRejectedValueOnce(Error("Cannot load now"));
    render(<Chat live view="page" items={[]} onRefresh={vi.fn()} />);
    await openHistory();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot load now");
    expect(service.sendConversationMessage).not.toHaveBeenCalled();
    expect(saved.messages).toHaveLength(2);
    await openHistory();
    expect(screen.getByRole("article", { name: "Saul’s reply" })).toHaveTextContent("Earlier saved answer");
  });
});

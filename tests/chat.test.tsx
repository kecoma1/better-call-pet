import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
vi.mock("../src/services/chat", async (original) => ({
  ...(await original<typeof import("../src/services/chat")>()),
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
}));
vi.mock("../src/firebase", () => ({ auth: null }));
import * as service from "../src/services/chat";
import Chat from "../src/components/chat";
import ChatMessage from "../src/components/chat-message";
import ChatToolCards from "../src/components/chat-tool-cards";
import { useConversations } from "../src/hooks/use-conversations";
import { defaultCompany, demoReceipts, type Conversation } from "../src/domain";
const id = "11111111-1111-4111-8111-111111111111";
const conversation: Conversation = {
  id,
  title: "VAT recovery",
  topic: "VAT",
  provider: "openai-decisions",
  updatedAt: "2026-11-01T12:00:00.000Z",
  preview: "Review the invoices.",
  messages: [
    { role: "user", content: "VAT recovery" },
    { role: "assistant", content: "Review the invoices." },
  ],
};
beforeEach(() => {
  vi.mocked(service.fetchConversations).mockReset().mockResolvedValue([]);
  vi.mocked(service.fetchConversation)
    .mockReset()
    .mockResolvedValue(conversation);
  vi.mocked(service.sendConversationMessage)
    .mockReset()
    .mockResolvedValue(conversation);
});
function openFloating() {
  fireEvent.click(screen.getByRole("button", { name: "Open chat with Saul" }));
}
function send(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Message Saul" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}
describe("chat messages and deterministic cards", () => {
  it("exposes one complete accessible answer while revealing visual words in order", () => {
    render(
      <ChatMessage
        message={{ role: "assistant", content: "One two\nthree" }}
        animate
      />,
    );
    const article = screen.getByRole("article", { name: "Saul’s reply" });
    expect(within(article).getByText("One two three")).toBeInTheDocument();
    expect(within(article).getByText("One").parentElement).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
  it("keeps user text plain and never renders supplied markup as HTML", () => {
    render(
      <ChatMessage
        message={{ role: "user", content: "<script>alert('x')</script>" }}
        animate
      />,
    );
    expect(
      screen.getByRole("article", { name: "Your message" }),
    ).toHaveTextContent("<script>");
    expect(document.querySelector("script")).toBeNull();
  });
  it("lists tools and receipt facts, opens a record and handles empty lists", () => {
    const open = vi.fn();
    const { rerender } = render(
      <ChatToolCards
        tools={[{ name: "list_receipts", receipts: demoReceipts }]}
        demo={false}
        onOpenReceipt={open}
      />,
    );
    expect(screen.getByLabelText("Tools used")).toHaveTextContent(
      "Receipts listed",
    );
    expect(screen.getByText("£102.00")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Open receipt Paper & Co." }),
    );
    expect(open).toHaveBeenCalledWith(demoReceipts[0].id);
    rerender(
      <ChatToolCards tools={[{ name: "list_receipts", receipts: [] }]} demo />,
    );
    expect(screen.getByText("No receipts found.")).toBeVisible();
    expect(screen.getByLabelText("Demo tool examples")).toHaveTextContent(
      "Demo",
    );
  });
  it("collapses longer lists, shows explicit limits and company fields", () => {
    const receipts = Array.from({ length: 7 }, (_, i) => ({
      ...demoReceipts[0],
      id: `sample-${i}`,
      vendor: `Supplier ${i}`,
    }));
    render(
      <ChatToolCards
        tools={[
          { name: "list_receipts", receipts, receiptCount: 30 },
          { name: "get_company", company: defaultCompany },
        ]}
        demo={false}
      />,
    );
    expect(screen.queryByText("Supplier 6")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Show 2 more receipts" }),
    );
    expect(screen.getByText("Supplier 6")).toBeVisible();
    expect(screen.getByText(/Showing the first 7 receipts/)).toBeVisible();
    expect(screen.getByText(defaultCompany.name)).toBeVisible();
    expect(screen.getByText("Registered")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("Supplier 6")).not.toBeInTheDocument();
  });
});
describe("shared floating and full-page conversation", () => {
  it("starts empty, sends demo messages, preserves drafts between views and reopens saved history", async () => {
    const props = { live: false, items: demoReceipts, onRefresh: vi.fn() };
    const { rerender } = render(<Chat {...props} view="page" />);
    expect(
      screen.getByRole("heading", { name: "Let’s talk books." }),
    ).toBeVisible();
    expect(screen.getByText(/Your first conversation starts/)).toBeVisible();
    send("VAT question");
    await within(screen.getByRole("log")).findByText(
      /This is the demo workspace/,
    );
    expect(
      screen.getByRole("navigation", { name: "Conversation history" }),
    ).toHaveTextContent("VAT");
    fireEvent.change(screen.getByLabelText("Message Saul"), {
      target: { value: "Unsent draft" },
    });
    rerender(<Chat {...props} view="floating" />);
    openFloating();
    expect(screen.getByLabelText("Message Saul")).toHaveValue("Unsent draft");
    rerender(<Chat {...props} view="page" />);
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.getByLabelText("Message Saul")).toHaveValue("");
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Conversation history" }),
      ).getByRole("button"),
    );
    await within(screen.getByRole("log")).findByText(
      /This is the demo workspace/,
    );
    expect(service.sendConversationMessage).not.toHaveBeenCalled();
  });
  it("filters conversations by search and every requested topic", async () => {
    localStorage.setItem(
      "bcp-demo-chats-v1",
      JSON.stringify([
        conversation,
        {
          ...conversation,
          id: "other",
          title: "Company year-end",
          topic: "Annual accounts",
        },
      ]),
    );
    render(<Chat live={false} items={[]} onRefresh={vi.fn()} view="page" />);
    const history = screen.getByRole("navigation", {
      name: "Conversation history",
    });
    expect(within(history).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Annual accounts", exact: true }),
    );
    expect(within(history).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Corporate Tax", exact: true }),
    );
    expect(
      screen.getByText("No conversations match your search."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "All", exact: true }));
    fireEvent.change(screen.getByLabelText("Search conversations"), {
      target: { value: "year-end" },
    });
    expect(within(history).getAllByRole("button")).toHaveLength(1);
  });
  it("keeps an in-flight request alive when switching between chat views", async () => {
    let finish!: () => void;
    vi.mocked(service.sendConversationMessage).mockImplementationOnce(
      (sentId) =>
        new Promise((resolve) => {
          finish = () => resolve({ ...conversation, id: sentId });
        }),
    );
    const props = {
      live: true,
      items: [],
      onRefresh: vi.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(<Chat {...props} view="page" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Message Saul")).toBeEnabled(),
    );
    send("VAT recovery");
    const signal = vi.mocked(service.sendConversationMessage).mock.calls[0][3]!;
    rerender(<Chat {...props} view="floating" />);
    openFloating();
    expect(signal.aborted).toBe(false);
    await act(async () => finish());
    expect(
      within(screen.getByRole("log")).getByText("Review the invoices."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
  it("shows live failures, retains input and retries with the same request ID", async () => {
    vi.mocked(service.sendConversationMessage).mockRejectedValueOnce(
      Error("Decisions unavailable"),
    );
    render(<Chat live items={[]} onRefresh={vi.fn()} view="page" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Message Saul")).toBeEnabled(),
    );
    send("VAT recovery");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Decisions unavailable",
    );
    expect(screen.getByLabelText("Message Saul")).toHaveValue("VAT recovery");
    const [sentId, , requestId] = vi.mocked(service.sendConversationMessage)
      .mock.calls[0];
    vi.mocked(service.sendConversationMessage).mockResolvedValueOnce({
      ...conversation,
      id: sentId,
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findAllByText("Review the invoices.");
    expect(vi.mocked(service.sendConversationMessage).mock.calls[1][2]).toBe(
      requestId,
    );
    expect(
      screen.queryByLabelText("Demo tool examples"),
    ).not.toBeInTheDocument();
  });
  it("keeps a successful reply if refreshing receipts fails and disables duplicate sends", async () => {
    let resolve!: (value: Conversation) => void;
    vi.mocked(service.sendConversationMessage).mockImplementationOnce(
      (sentId) =>
        new Promise((done) => {
          resolve = (value) => done({ ...value, id: sentId });
        }),
    );
    render(
      <Chat
        live
        items={[]}
        onRefresh={vi.fn().mockRejectedValue(Error("Offline"))}
        view="page"
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Message Saul")).toBeEnabled(),
    );
    send("VAT recovery");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "New conversation" }),
    ).toBeDisabled();
    await act(async () => resolve(conversation));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reply saved");
    expect(screen.getAllByText("Review the invoices.").length).toBeGreaterThan(
      0,
    );
  });
  it("shows history load failures with an explicit retry and ignores corrupt demo storage", async () => {
    localStorage.setItem("bcp-demo-chats-v1", "invalid json");
    const { unmount } = render(
      <Chat live={false} items={[]} onRefresh={vi.fn()} view="page" />,
    );
    expect(screen.getByText(/Your first conversation starts/)).toBeVisible();
    unmount();
    vi.mocked(service.fetchConversations).mockRejectedValueOnce(
      Error("History unavailable"),
    );
    render(<Chat live items={[]} onRefresh={vi.fn()} view="page" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History unavailable",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh conversations" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
  it("loads selected server history and handles a missing conversation", async () => {
    vi.mocked(service.fetchConversations).mockResolvedValue([conversation]);
    vi.mocked(service.fetchConversation).mockRejectedValueOnce(
      Error("Conversation not found"),
    );
    render(<Chat live items={[]} onRefresh={vi.fn()} view="page" />);
    const history = await screen.findByRole("navigation", {
      name: "Conversation history",
    });
    const select = await within(history).findByRole("button");
    await waitFor(() => expect(select).toBeEnabled());
    fireEvent.click(select);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conversation not found",
    );
    fireEvent.click(select);
    await screen.findAllByText("Review the invoices.");
  });
  it("supports closing and expanding the floating chat", () => {
    const expand = vi.fn();
    render(
      <Chat live={false} items={[]} onRefresh={vi.fn()} onExpand={expand} />,
    );
    openFloating();
    fireEvent.click(
      screen.getByRole("button", { name: "Open all conversations" }),
    );
    expect(expand).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(
      screen.getByRole("button", { name: "Open chat with Saul" }),
    ).toBeVisible();
  });
});
describe("conversation lifecycle", () => {
  it("aborts reads on unmount and clears live state when the owning account is remounted", async () => {
    const { result, unmount } = renderHook(() =>
      useConversations(true, [], vi.fn()),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const signal = vi.mocked(service.fetchConversations).mock.calls[0][0]!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});

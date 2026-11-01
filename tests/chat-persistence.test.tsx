import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
vi.mock("../src/services/conversation", () => ({ fetchConversation: vi.fn(), saveConversation: vi.fn() }));
vi.mock("../src/services/workspace", () => ({ sendChat: vi.fn() }));
import { fetchConversation, saveConversation } from "../src/services/conversation";
import { sendChat } from "../src/services/workspace";
import Chat from "../src/components/chat";
import type { ChatMessage } from "../src/lib/conversation";

let saved: ChatMessage[];
beforeEach(() => {
  saved = [{ role: "user", content: "Earlier question" }, { role: "assistant", content: "Earlier saved answer" }];
  vi.mocked(fetchConversation).mockReset().mockImplementation(async () => saved);
  vi.mocked(saveConversation).mockReset().mockImplementation(async (messages) => { saved = messages; });
  vi.mocked(sendChat).mockReset().mockResolvedValue("New live answer");
});
async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Open chat with Saul" }));
  await waitFor(() => expect(screen.getByLabelText("Message Saul")).toBeEnabled());
}
describe("saved real AI conversations", () => {
  it("restores the conversation, saves replies and resumes after remounting", async () => {
    const mounted = render(<Chat live items={[]} onRefresh={vi.fn()} />);
    await open();
    expect(screen.getByText("Earlier saved answer")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Next question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("New live answer")).toBeVisible();
    await waitFor(() => expect(saved.at(-1)?.content).toBe("New live answer"));
    mounted.unmount();
    render(<Chat live items={[]} onRefresh={vi.fn()} />);
    await open();
    expect(screen.getByText("Next question")).toBeVisible();
    expect(screen.getByText("New live answer")).toBeVisible();
  });
  it("protects unread history when loading fails and allows retry", async () => {
    vi.mocked(fetchConversation).mockRejectedValueOnce(Error("History unavailable"));
    render(<Chat live items={[]} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open chat with Saul" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("History unavailable");
    expect(screen.getByLabelText("Message Saul")).toBeDisabled();
    expect(saveConversation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry conversation" }));
    expect(await screen.findByText("Earlier saved answer")).toBeVisible();
    expect(screen.getByLabelText("Message Saul")).toBeEnabled();
  });
  it("keeps the user's saved question on AI failure without a demo replacement", async () => {
    vi.mocked(sendChat).mockRejectedValueOnce(Error("Provider unavailable"));
    render(<Chat live items={[]} onRefresh={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Keep this question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provider unavailable");
    expect(saved.at(-1)).toEqual({ role: "user", content: "Keep this question" });
    expect(screen.queryByText(/This is the demo workspace/)).not.toBeInTheDocument();
  });
  it("reports save failure before starting a provider request", async () => {
    vi.mocked(saveConversation).mockRejectedValueOnce(Error("Cannot save now"));
    render(<Chat live items={[]} onRefresh={vi.fn()} />);
    await open();
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Keep this visible" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot save now");
    expect(screen.getByText("Keep this visible")).toBeVisible();
    expect(sendChat).not.toHaveBeenCalled();
  });
});

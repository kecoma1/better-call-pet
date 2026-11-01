import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { demoReceipts } from "../src/domain";

vi.mock("../src/firebase", () => ({ auth: null, signIn: vi.fn() }));
vi.mock("../src/services/workspace", () => ({ sendChat: vi.fn() }));
import { sendChat } from "../src/services/workspace";
import Chat from "../src/components/chat";
import Saul from "../src/components/saul";
import App from "../src/App";

const props = { live: false, items: demoReceipts, onRefresh: vi.fn() };

describe("chat as the workspace home", () => {
  it("opens on an empty chat with pacing Saul and keeps Overview in the navigation", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Let’s talk business." })).toBeVisible();
    expect(screen.getByRole("img", { name: /walking from left to right/ })).toHaveAttribute("src", "/chibi/saul-pacing.png");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Overview", exact: true }));
    expect(screen.getByRole("heading", { name: "Your books, in good hands." })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Chat with Saul" })).not.toBeInTheDocument();
  });

  it("preserves messages and drafts when navigating, then clears them for a new conversation", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "What needs my attention?" }));
    expect(await screen.findByText(/This is the demo workspace/)).toBeVisible();
    expect(screen.queryByRole("img", { name: /walking from left to right/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Draft question" } });
    fireEvent.click(screen.getByRole("button", { name: /^Receipts/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chat", exact: true }));
    expect(screen.getByText("What needs my attention?")).toBeVisible();
    expect(screen.getByLabelText("Message Saul")).toHaveValue("Draft question");
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.getByRole("img", { name: /walking from left to right/ })).toBeVisible();
    expect(screen.queryByText(/This is the demo workspace/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message Saul")).toHaveValue("");
    expect(screen.getByLabelText("Message Saul")).toHaveFocus();
  });

  it("shows thinking while awaiting a live reply and blocks resetting or sending twice", async () => {
    let respond!: (reply: string) => void;
    vi.mocked(sendChat).mockReturnValueOnce(new Promise((resolve) => { respond = resolve; }));
    render(<Chat {...props} live onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Hello Saul" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("status")).toHaveTextContent("Reading the fine print");
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-thinking.png");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New conversation" })).toBeDisabled();
    respond("Let’s look at your receipts.");
    expect(await screen.findByText("Let’s look at your receipts.")).toBeVisible();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-approved.png");
  });

  it("keeps a failed question available to retry and clears errors on a new conversation", async () => {
    vi.mocked(sendChat).mockRejectedValueOnce(Error("Saul is unavailable"));
    render(<Chat {...props} live />);
    fireEvent.change(screen.getByLabelText("Message Saul"), { target: { value: "Check my receipts" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saul is unavailable");
    expect(screen.getByLabelText("Message Saul")).toHaveValue("Check my receipts");
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message Saul")).toHaveValue("");
  });

  it("sends with Enter but leaves Shift+Enter and IME composition for typing", async () => {
    render(<Chat {...props} />);
    const input = screen.getByLabelText("Message Saul");
    fireEvent.change(input, { target: { value: "Check my VAT" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(input).toHaveValue("Check my VAT");
    expect(screen.queryByText(/This is the demo workspace/)).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByText(/This is the demo workspace/)).toBeVisible());
  });

  it("falls back to the matching pacing still if the animation fails", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    render(<Saul state="pacing" />);
    const saul = screen.getByRole("img", { name: /walking from left to right/ });
    expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.webp");
    fireEvent.error(saul);
    expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.png");
  });
});

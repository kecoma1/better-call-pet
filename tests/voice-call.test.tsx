import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../src/services/voice", () => ({ startVoiceCall: mock.start }));
import VoiceCall from "../src/components/voice-call";

import AnimatedCaption from "../src/components/animated-caption";
import type { CallEvent } from "../src/services/voice";

beforeEach(() => { mock.start.mockReset(); });
describe("Saul calls", () => {
  it("keeps chat turns and adds real cards beneath them as tools complete", async () => {
    let emit!: (event: CallEvent) => void;
    mock.start.mockImplementation((_input, receive, signal) => {
      emit = receive;
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
    });
    const onEnd = vi.fn();
    render(<VoiceCall live disabled={false} messages={[{ role: "assistant", content: "Previous chat message." }]} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    const chat = screen.getByRole("region", { name: "Live captions" });
    expect(chat).toHaveTextContent("Previous chat message.");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Receipts loaded")).not.toBeInTheDocument();
    const tool = { name: "create_receipt" as const, receipts: [{ id: "receipt-1", vendor: "Fixture supplier", netPence: 1000, vatPence: 200, status: "review" as const }] };
    act(() => {
      emit({ type: "ready" });
      emit({ type: "transcript", role: "user", text: "Add this receipt.", startMs: 0, endMs: 500 });
      emit({ type: "transcript", role: "assistant", text: "Let me save it.", startMs: 600, endMs: 1000 });
      emit({ type: "tool", id: "delegation-1-0", tool });
    });
    const articles = within(chat).getAllByRole("article");
    expect(articles.map((article) => article.textContent)).toEqual([
      "Previous chat message.", "Add this receipt.", "Let me save it.",
      expect.stringContaining("Receipt draft · awaiting review"),
    ]);
    expect(chat).toHaveTextContent("Fixture supplier");
    expect(chat).toHaveTextContent("£12.00");
    act(() => {
      emit({ type: "tool", id: "delegation-1-0", tool });
      emit({ type: "transcript", role: "user", text: "What next?", startMs: 3000, endMs: 3500 });
      emit({ type: "transcript", role: "assistant", text: "Review the draft.", startMs: 4000, endMs: 4500 });
    });
    expect(within(chat).getAllByRole("article")).toHaveLength(6);
    expect(chat).toHaveTextContent("Let me save it.");
    expect(within(chat).getAllByText("Receipt draft · awaiting review")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onEnd.mock.calls[0][1][2].tools).toEqual([tool]);
    expect(onEnd.mock.calls[0][1].at(-1).content).toBe("Review the draft.");
  });

  it("keeps the call and its chat open after a workspace refresh failure", async () => {
    let emit!: (event: CallEvent) => void;
    mock.start.mockImplementation((_input, receive, signal) => {
      emit = receive;
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
    });
    const onRefresh = vi.fn().mockRejectedValueOnce(Error("Offline")).mockResolvedValue(undefined);
    const onEnd = vi.fn();
    render(<VoiceCall live disabled={false} messages={[]} onRefresh={onRefresh} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    expect(screen.getByRole("button", { name: "End call" })).toHaveFocus();
    act(() => { emit({ type: "ready" }); emit({ type: "listening" }); });
    expect(onRefresh).not.toHaveBeenCalled();
    act(() => { emit({ type: "working" }); });
    expect(screen.getByRole("status")).toHaveTextContent("Checking your books…");
    act(() => { emit({ type: "listening" }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update your records.");
    expect(screen.getByRole("button", { name: "End call" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(onRefresh).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("starts directly, renders both speakers and mutes before hanging up", async () => {
    const mute = vi.fn(), onEnd = vi.fn();
    let emit!: (event: CallEvent) => void;
    mock.start.mockImplementation((_input, receive, signal, controls) => {
      emit = receive; controls(mute);
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
    });
    render(<VoiceCall live disabled={false} messages={[]} onEnd={onEnd} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    expect(screen.getByRole("dialog", { name: "Better call Saul." })).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    act(() => {
      emit({ type: "ready" });
      emit({ type: "transcript", role: "user", text: "Check my books", startMs: 0, endMs: 500 });
      emit({ type: "transcript", role: "assistant", text: "On it.", startMs: 600, endMs: 900 });
    });
    expect(screen.getByRole("region", { name: "Live captions" })).toHaveTextContent("Check my books");
    expect(screen.getByRole("region", { name: "Live captions" })).toHaveTextContent("On it.");
    fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
    expect(mute).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onEnd.mock.calls[0][0].map((c: {text: string}) => c.text)).toEqual(["Check my books", "On it."]);
  });
  it("shows microphone errors and allows a direct retry", async () => {
    mock.start.mockRejectedValue(Error("Microphone access is blocked."));
    render(<VoiceCall live disabled={false} messages={[]} onEnd={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone access is blocked.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mock.start).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
  });
  it("ends on sign-out and unmount", async () => {
    let signal!: AbortSignal;
    mock.start.mockImplementation((_input, _receive, current) => { signal = current; return new Promise<void>((resolve) => current.addEventListener("abort", resolve)); });
    const props = { disabled: false, messages: [], onEnd: vi.fn() };
    const { rerender, unmount } = render(<VoiceCall live {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    rerender(<VoiceCall live={false} {...props} />);
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<VoiceCall live {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Call Saul" }));
    unmount(); expect(signal.aborted).toBe(true);
  });
  it("makes demo voice availability explicit", () => {
    render(<VoiceCall live={false} disabled={false} messages={[]} onEnd={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Call Saul" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Call Saul" })).toHaveAttribute("title", "Sign in to call Saul");
  });
  it("keeps animated text readable and preserves old words during streaming", () => {
    const { container, rerender } = render(<AnimatedCaption text="Hello Saul" />);
    const first = container.querySelector(".animated-caption > span");
    expect(container).toHaveTextContent("Hello Saul");
    rerender(<AnimatedCaption text="Hello Saul, check this." />);
    expect(container.querySelector(".animated-caption > span")).toBe(first);
    expect(container).toHaveTextContent("Hello Saul, check this.");
  });
});

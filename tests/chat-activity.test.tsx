import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import ChatActivity from "../src/components/chat-activity";
import type { ChatEvent } from "../src/domain";
describe("live agent activity", () => {
  it("renders real stages and tool states in order", () => {
    const events: ChatEvent[] = [
      { sequence: 0, kind: "classifying", at: "2026-11-01T12:00:00.000Z" },
      {
        sequence: 1,
        kind: "classified",
        topic: "VAT",
        at: "2026-11-01T12:00:01.000Z",
      },
      {
        sequence: 2,
        kind: "tool_started",
        tool: "get_company",
        at: "2026-11-01T12:00:02.000Z",
      },
      {
        sequence: 3,
        kind: "tool_completed",
        tool: "get_company",
        at: "2026-11-01T12:00:03.000Z",
      },
      { sequence: 4, kind: "responding", at: "2026-11-01T12:00:04.000Z" },
      { sequence: 5, kind: "completed", at: "2026-11-01T12:00:05.000Z" },
    ];
    render(<ChatActivity events={events} />);
    fireEvent.click(screen.getByText("Activity", { exact: true }));
    expect(
      within(screen.getByRole("list", { name: "Agent activity" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Classifying your question",
      "Topic: VAT",
      "Checking company details",
      "Company details checked",
      "Writing reply",
      "Reply saved",
    ]);
  });
  it("handles empty and failed activity", () => {
    const { rerender, container } = render(<ChatActivity events={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <ChatActivity
        events={[
          { sequence: 0, kind: "tool_failed", at: "2026-11-01T12:00:00.000Z" },
          { sequence: 1, kind: "failed", at: "2026-11-01T12:00:01.000Z" },
        ]}
      />,
    );
    expect(screen.getByText("Tool could not finish")).toBeVisible();
    expect(screen.getByText("Reply could not finish")).toBeVisible();
  });
});

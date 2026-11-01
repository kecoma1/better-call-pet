import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VoiceWorkspace from "../src/components/voice-workspace";
import { demoReceipts } from "../src/domain";

describe("workspace cards during a call", () => {
  it("shows loaded records and only includes posted VAT in the total", () => {
    render(<VoiceWorkspace receipts={demoReceipts} refreshing={false} error="" />);
    const workspace = screen.getByRole("complementary", { name: "Workspace during call" });
    expect(workspace).toHaveTextContent("Receipts loaded3");
    expect(workspace).toHaveTextContent("Awaiting review2");
    expect(workspace).toHaveTextContent("Posted to books1");
    expect(workspace).toHaveTextContent("Posted VAT£3.00");
    expect(within(workspace).getByText("£102.00")).toBeVisible();
    expect(within(workspace).getByText("Posted", { exact: true })).toBeVisible();
    expect(workspace).toHaveTextContent("Draft receipts stay in review until you approve them.");
  });

  it("shows the four newest records without changing the shared receipt order", () => {
    const receipts = Array.from({ length: 6 }, (_, i) => ({
      ...demoReceipts[0], id: `receipt-${i}`, vendor: `Supplier ${i}`,
      createdAt: `2026-11-0${i + 1}T12:00:00Z`,
    }));
    render(<VoiceWorkspace receipts={receipts} refreshing={false} error="" />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Supplier 5");
    expect(rows[3]).toHaveTextContent("Supplier 2");
    expect(screen.queryByText("Supplier 0")).not.toBeInTheDocument();
    expect(receipts[0].vendor).toBe("Supplier 0");
  });

  it("explains the empty workspace and allows refresh retries without losing records", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<VoiceWorkspace receipts={[]} refreshing={false} error="" onRefresh={onRefresh} />);
    expect(screen.getByText("No receipts loaded yet.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Refresh workspace" }));
    expect(onRefresh).toHaveBeenCalledOnce();
    rerender(<VoiceWorkspace receipts={demoReceipts} refreshing error="" onRefresh={onRefresh} />);
    expect(screen.getByRole("button", { name: "Refresh workspace" })).toBeDisabled();
    expect(screen.getByRole("complementary")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Updating your records…")).toBeVisible();
    rerender(<VoiceWorkspace receipts={demoReceipts} refreshing={false} error="Could not update your records." onRefresh={onRefresh} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update your records.");
    expect(screen.getByText("Paper & Co.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Refresh workspace" })).toBeEnabled();
  });
});

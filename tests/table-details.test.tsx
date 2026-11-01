import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReceiptTable from "../src/components/receipt-table";
import ReceiptSheet from "../src/components/receipt-sheet";
import Books from "../src/pages/books";
import { demoReceipts } from "../src/domain";

describe("table detail sheets", () => {
  it("selects the expense when any data cell in its row is clicked", () => {
    const select = vi.fn();
    render(<ReceiptTable items={demoReceipts} onSelect={select} />);
    const row = screen.getByRole("row", {
      name: "View expense details for Paper & Co.",
    });
    fireEvent.click(within(row).getByRole("cell", { name: "£102.00" }));
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[0]);
    expect(row).toHaveFocus();
  });

  it.each(["Enter", " "])("supports %j on a focused expense row", (key) => {
    const select = vi.fn();
    render(<ReceiptTable items={demoReceipts} onSelect={select} />);
    const row = screen.getByRole("row", {
      name: "View expense details for The Ivy",
    });
    row.focus();
    fireEvent.keyDown(row, { key });
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[1]);
  });

  it("opens only once from the existing row action", () => {
    const select = vi.fn();
    render(<ReceiptTable items={demoReceipts} onSelect={select} />);
    fireEvent.click(screen.getByRole("button", { name: "Review Paper & Co." }));
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[0]);
  });

  it("selects the source expense from a ledger row", () => {
    const select = vi.fn();
    render(<Books items={demoReceipts} onSelect={select} />);
    fireEvent.click(
      screen.getByRole("cell", { name: "2101 · Trade creditors" }),
    );
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[2]);
  });

  it("supports keyboard access from ledger rows", () => {
    const select = vi.fn();
    render(<Books items={demoReceipts} onSelect={select} />);
    fireEvent.keyDown(
      screen.getByRole("row", {
        name: "View journal details for Figma UK, 2201 · VAT recoverable",
      }),
      { key: "Enter" },
    );
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[2]);
  });

  it("does not make empty table messages interactive", () => {
    const select = vi.fn();
    render(<ReceiptTable items={[]} onSelect={select} />);
    fireEvent.click(screen.getByText(/Your next receipt starts/));
    expect(select).not.toHaveBeenCalled();
  });

  it("does not open a sheet without a selection", () => {
    render(<ReceiptSheet receipt={null} onClose={vi.fn()} onPost={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the selected invoice facts, purpose, VAT and journal", () => {
    render(
      <ReceiptSheet
        receipt={demoReceipts[0]}
        onClose={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    const sheet = screen.getByRole("dialog", { name: "Paper & Co." });
    expect(sheet).toHaveTextContent("PC-1042");
    expect(sheet).toHaveTextContent("1 November 2026");
    expect(sheet).toHaveTextContent(demoReceipts[0].notes);
    expect(sheet).toHaveTextContent("£17.00");
    expect(sheet).toHaveTextContent("5000 · Office supplies");
    expect(
      within(sheet).getByRole("button", { name: "Approve & post to books" }),
    ).toBeEnabled();
  });

  it("preserves posted and needs-review restrictions", () => {
    const { rerender } = render(
      <ReceiptSheet
        receipt={demoReceipts[2]}
        onClose={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Already in your books" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("heading", { name: "Journal entry" }),
    ).toBeVisible();
    rerender(
      <ReceiptSheet
        receipt={{
          ...demoReceipts[0],
          decision: { ...demoReceipts[0].decision, verdict: "review" },
        }}
        onClose={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Approve & post to books" }),
    ).toBeDisabled();
  });

  it("stays open and preserves details after posting fails", async () => {
    const close = vi.fn();
    render(
      <ReceiptSheet
        receipt={demoReceipts[0]}
        onClose={close}
        onPost={vi.fn().mockRejectedValue(Error("Posting failed. Try again."))}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve & post to books" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Posting failed. Try again.",
    );
    expect(screen.getByRole("dialog", { name: "Paper & Co." })).toBeVisible();
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Approve & post to books" }),
    ).toBeEnabled();
  });

  it("prevents dismissal during posting and closes only after success", async () => {
    let finish!: () => void;
    const close = vi.fn();
    const post = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ReceiptSheet receipt={demoReceipts[0]} onClose={close} onPost={post} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve & post to books" }),
    );
    expect(
      screen.getByRole("button", { name: "Posting expense…" }),
    ).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledExactlyOnceWith(demoReceipts[0]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { demoReceipts, type Receipt } from "../src/domain";
import { expenseNotifications } from "../src/lib/notifications";
import NotificationsBanner from "../src/components/notifications-banner";

const missing: Receipt = {
  ...demoReceipts[0],
  id: "missing",
  validInvoice: false,
  decision: { ...demoReceipts[0].decision, verdict: "review" },
};
const vatReview: Receipt = {
  ...demoReceipts[0],
  id: "vat-review",
  decision: { ...demoReceipts[0].decision, verdict: "review" },
};

describe("current expense notifications", () => {
  it("groups pending work by missing evidence, VAT review and approval without duplicates", () => {
    const result = expenseNotifications([
      demoReceipts[0],
      missing,
      vatReview,
      demoReceipts[2],
    ]);
    expect(result.map((notification) => notification.id)).toEqual([
      "missing-invoices",
      "vat-review",
      "expense-approval",
    ]);
    expect(
      result.flatMap((notification) =>
        notification.receipts.map((receipt) => receipt.id),
      ),
    ).toEqual(["missing", "vat-review", "sample-0"]);
  });

  it("includes blocked VAT expenses in approval work without claiming VAT is recoverable", () => {
    const result = expenseNotifications([demoReceipts[1]]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("expense-approval");
    expect(result[0].receipts[0].decision.reclaimPence).toBe(0);
  });

  it("does not produce notifications for posted expenses or an empty workspace", () => {
    expect(expenseNotifications([])).toEqual([]);
    expect(
      expenseNotifications([
        { ...missing, status: "posted" },
        { ...vatReview, status: "posted" },
        demoReceipts[2],
      ]),
    ).toEqual([]);
  });
});

describe("Saul notification banner", () => {
  it("replaces the promotional hero with actionable approval work", () => {
    const select = vi.fn();
    render(
      <NotificationsBanner
        items={demoReceipts}
        onSelect={select}
        onAdd={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    const banner = screen.getByRole("region", { name: "Notifications" });
    expect(within(banner).getByRole("heading")).toHaveTextContent(
      "2 expenses are waiting for your approval.",
    );
    fireEvent.click(
      within(banner).getByRole("button", { name: "Review next expense" }),
    );
    expect(select).toHaveBeenCalledExactlyOnceWith(demoReceipts[0]);
    expect(
      screen.queryByRole("button", { name: "Next notification" }),
    ).not.toBeInTheDocument();
  });

  it("allows browsing notification groups and opens the matching expense", () => {
    const select = vi.fn();
    render(
      <NotificationsBanner
        items={[demoReceipts[0], missing, vatReview]}
        onSelect={select}
        onAdd={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(
      "A receipt is missing its invoice.",
    );
    fireEvent.click(screen.getByRole("button", { name: "View receipt" }));
    expect(select).toHaveBeenLastCalledWith(missing);
    fireEvent.click(screen.getByRole("button", { name: "Next notification" }));
    expect(screen.getByText("2 of 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Review VAT" }));
    expect(select).toHaveBeenLastCalledWith(vatReview);
    fireEvent.click(
      screen.getByRole("button", { name: "Previous notification" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Previous notification" }),
    );
    expect(screen.getByText("3 of 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Review expense" }));
    expect(select).toHaveBeenLastCalledWith(demoReceipts[0]);
  });

  it("updates immediately when an active notification is resolved", () => {
    const props = { onSelect: vi.fn(), onAdd: vi.fn(), onNavigate: vi.fn() };
    const { rerender } = render(
      <NotificationsBanner {...props} items={[missing, vatReview]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next notification" }));
    expect(screen.getByRole("heading")).toHaveTextContent(
      "One VAT decision needs a closer look.",
    );
    rerender(
      <NotificationsBanner
        {...props}
        items={[missing, { ...vatReview, status: "posted" }]}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(
      "A receipt is missing its invoice.",
    );
    rerender(
      <NotificationsBanner
        {...props}
        items={demoReceipts.filter((receipt) => receipt.status === "posted")}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(
      "You're all caught up.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open bookkeeping" }));
    expect(props.onNavigate).toHaveBeenCalledExactlyOnceWith("Bookkeeping");
  });

  it("shows a useful empty state without inventing alerts", () => {
    const add = vi.fn();
    render(
      <NotificationsBanner
        items={[]}
        onSelect={vi.fn()}
        onAdd={add}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText(/No expense notifications yet/)).toBeVisible();
    expect(screen.getByText("No pending expense updates")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Add your first expense" }),
    );
    expect(add).toHaveBeenCalledOnce();
  });
});

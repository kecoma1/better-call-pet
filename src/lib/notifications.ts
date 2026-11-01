import type { Receipt } from "../domain";

export interface ExpenseNotification {
  id: "missing-invoices" | "vat-review" | "expense-approval";
  title: string;
  message: string;
  actionLabel: string;
  summary: string;
  receipts: Receipt[];
}

/** Current expense work, rather than invented events or unread counts. */
export function expenseNotifications(items: Receipt[]): ExpenseNotification[] {
  const pending = items.filter((receipt) => receipt.status === "review");
  const missing = pending.filter((receipt) => !receipt.validInvoice);
  const vatReview = pending.filter(
    (receipt) => receipt.validInvoice && receipt.decision.verdict === "review",
  );
  const approval = pending.filter(
    (receipt) => receipt.validInvoice && receipt.decision.verdict !== "review",
  );
  const notifications: ExpenseNotification[] = [];

  if (missing.length)
    notifications.push({
      id: "missing-invoices",
      title:
        missing.length === 1
          ? "A receipt is missing its invoice."
          : `${missing.length} receipts are missing their invoices.`,
      message:
        "Invoice evidence is missing. Open the receipt to check what needs completing before finishing your review.",
      actionLabel: missing.length === 1 ? "View receipt" : "View next receipt",
      summary: `${missing.length} ${missing.length === 1 ? "invoice needs" : "invoices need"} attention`,
      receipts: missing,
    });

  if (vatReview.length)
    notifications.push({
      id: "vat-review",
      title:
        vatReview.length === 1
          ? "One VAT decision needs a closer look."
          : `${vatReview.length} VAT decisions need a closer look.`,
      message:
        "Some VAT details need a human review. Check the receipt and Saul’s reasoning before anything is posted.",
      actionLabel: "Review VAT",
      summary: `${vatReview.length} VAT ${vatReview.length === 1 ? "review" : "reviews"} pending`,
      receipts: vatReview,
    });

  if (approval.length)
    notifications.push({
      id: "expense-approval",
      title:
        approval.length === 1
          ? "An expense is waiting for your approval."
          : `${approval.length} expenses are waiting for your approval.`,
      message:
        "Check the invoice details and VAT decision, then approve each expense when you’re ready to put it in the books.",
      actionLabel:
        approval.length === 1 ? "Review expense" : "Review next expense",
      summary: `${approval.length} ${approval.length === 1 ? "expense awaits" : "expenses await"} approval`,
      receipts: approval,
    });

  return notifications;
}

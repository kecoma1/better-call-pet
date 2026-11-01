import { useRef, useState } from "react";
import { FileCheck2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import VerdictBadge from "./verdict-badge";
import Saul from "./saul";
import { journal, money, type Receipt } from "../domain";

export default function ReceiptSheet({
  receipt,
  onClose,
  onPost,
}: {
  receipt: Receipt | null;
  onClose: () => void;
  onPost: (receipt: Receipt) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);

  async function post() {
    if (!receipt || busy) return;
    setBusy(true);
    setError("");
    try {
      await onPost(receipt);
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={!!receipt}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
        aria-busy={busy}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
      >
        <SheetHeader className="px-6 pt-6 pr-12 pb-5">
          <SheetTitle>{receipt?.vendor || "Expense details"}</SheetTitle>
          <SheetDescription>
            Review the expense, VAT decision and accounting entry.
          </SheetDescription>
        </SheetHeader>
        {receipt && (
          <div className="receipt-detail px-6 pb-6">
            <div className="mb-5">
              <Badge variant="outline">
                {receipt.status === "posted" ? "Posted" : "To review"}
              </Badge>
            </div>
            <dl className="expense-metadata">
              <div>
                <dt>Invoice date</dt>
                <dd>
                  {new Date(receipt.date + "T12:00:00Z").toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </dd>
              </div>
              <div>
                <dt>Invoice reference</dt>
                <dd>{receipt.reference || "Not provided"}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{receipt.category}</dd>
              </div>
              <div>
                <dt>Business use</dt>
                <dd>{receipt.businessPercent}%</dd>
              </div>
              <div>
                <dt>VAT invoice</dt>
                <dd>
                  {receipt.validInvoice ? "Available" : "Missing / unsure"}
                </dd>
              </div>
            </dl>
            {receipt.notes && (
              <div className="expense-notes">
                <h4>Business purpose</h4>
                <p>{receipt.notes}</p>
              </div>
            )}
            <div className="receipt-facts">
              <span>
                Invoice total
                <strong>{money(receipt.netPence + receipt.vatPence)}</strong>
              </span>
              <span>
                VAT on invoice<strong>{money(receipt.vatPence)}</strong>
              </span>
              <span>
                Recoverable VAT
                <strong>{money(receipt.decision.reclaimPence)}</strong>
              </span>
            </div>
            <div className="decision-summary">
              <Saul
                state={
                  receipt.decision.verdict === "deductible"
                    ? "approved"
                    : "thinking"
                }
              />
              <div>
                <VerdictBadge verdict={receipt.decision.verdict} />
                <p>{receipt.decision.reason}</p>
                <small>
                  {receipt.decision.provider === "demo-rules"
                    ? "Demo · illustrative rules"
                    : "OpenAI Decisions · gpt-6-luna"}
                  {receipt.decision.confidence !== null
                    ? " · " +
                      Math.round(receipt.decision.confidence * 100) +
                      "% confidence"
                    : ""}
                </small>
                <a
                  href={receipt.decision.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read HMRC guidance ↗
                </a>
              </div>
            </div>
            <h4>
              {receipt.status === "posted"
                ? "Journal entry"
                : "Proposed journal"}
            </h4>
            {journal(receipt).map((line) => (
              <div className="journal-line" key={line.account}>
                <span>{line.account}</span>
                <span>{line.debit ? money(line.debit) : "—"}</span>
                <span>{line.credit ? money(line.credit) : "—"}</span>
              </div>
            ))}
            <p className="hint">
              DR / CR · Personal costs go to the director loan account. The
              credit remains payable until bank reconciliation.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button
              disabled={
                busy ||
                receipt.status === "posted" ||
                receipt.decision.verdict === "review"
              }
              onClick={() => void post()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
              {busy
                ? "Posting expense…"
                : receipt.status === "posted"
                  ? "Already in your books"
                  : "Approve & post to books"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

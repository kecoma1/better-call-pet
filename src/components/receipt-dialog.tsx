import { useState } from "react";
import {
  Upload,
  Loader2,
  Check,
  ArrowRight,
  FileCheck2,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  examples,
  journal,
  money,
  type Receipt,
  type ReceiptInput,
  type Category,
} from "../domain";
import { extractReceipt } from "../services/workspace";
import VerdictBadge from "./verdict-badge";
import Saul from "./saul";
import "./receipt-dialog.css";

const emptyReceipt: ReceiptInput = {
  ...examples[0],
  vendor: "",
  date: "",
  reference: "",
  netPence: 0,
  vatPence: 0,
  notes: "",
};

export default function ReceiptDialog({
  receipt,
  onClose,
  onAdd,
  onPost,
  live,
}: {
  receipt: Receipt | "new" | null;
  onClose: () => void;
  onAdd: (r: ReceiptInput) => Promise<void>;
  onPost: (r: Receipt) => Promise<void>;
  live: boolean;
}) {
  const [form, setForm] = useState<ReceiptInput>({ ...emptyReceipt }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [image, setImage] = useState<string>(),
    [fileName, setFileName] = useState(""),
    [missingAmounts, setMissingAmounts] = useState<("netPence" | "vatPence")[]>(
      ["netPence", "vatPence"],
    ),
    [step, setStep] = useState<"upload" | "reading" | "review">("upload"),
    [extractNote, setExtractNote] = useState("");
  const existing = receipt && receipt !== "new" ? receipt : null;
  const change = (key: keyof ReceiptInput, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    setImage(undefined);
    setFileName("");
    setForm({ ...emptyReceipt });
    setMissingAmounts(["netPence", "vatPence"]);
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 4500000
    ) {
      setError("Choose a PNG, JPG or WebP image below 4.5 MB.");
      return;
    }
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () =>
          reject(Error("Could not read this image. Please choose it again."));
        fr.readAsDataURL(file);
      });
      setImage(data);
      setFileName(file.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function readReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!image || busy) return;
    setError("");
    setStep("reading");
    if (!live) return;
    setBusy(true);
    try {
      const d = await extractReceipt(image);
      if (d.currency && d.currency !== "GBP")
        throw Error("Only GBP receipts are supported in this first version.");
      setForm((p) => ({
        ...p,
        vendor: d.vendor ?? "",
        date: d.date ?? "",
        reference: d.reference ?? "",
        netPence: d.netPence ?? 0,
        vatPence: d.vatPence ?? 0,
      }));
      setMissingAmounts(
        (["netPence", "vatPence"] as const).filter((key) => d[key] === null),
      );
      setExtractNote(
        "Check the extracted fields against your receipt. Complete any missing details and confirm the business use before continuing.",
      );
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep("upload");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !form.vendor.trim() || !form.date || missingAmounts.length)
      return;
    setBusy(true);
    setError("");
    try {
      await onAdd({ ...form, ...(image ? { image } : {}) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!receipt}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="receipt-modal">
        <DialogHeader>
          <DialogTitle>
            {existing ? existing.vendor : "Give your receipt a fair hearing."}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? "Review the VAT decision and accounting entry."
              : step === "upload"
                ? "Upload a receipt. Saul will take a look at the details."
                : step === "reading" || busy
                  ? "A little help with the fine print."
                  : "Check the details. Saul will help you make sense of the VAT."}
          </DialogDescription>
        </DialogHeader>
        {existing ? (
          <div className="receipt-detail">
            <div className="decision-summary">
              <Saul
                state={
                  existing.decision.verdict === "deductible"
                    ? "approved"
                    : "thinking"
                }
              />
              <div>
                <VerdictBadge verdict={existing.decision.verdict} />
                <p>{existing.decision.reason}</p>
                <small>
                  {existing.decision.provider === "demo-rules"
                    ? "Demo · illustrative rules"
                    : "OpenAI Decisions · gpt-6-luna"}
                  {existing.decision.confidence !== null
                    ? " · " +
                      Math.round(existing.decision.confidence * 100) +
                      "% confidence"
                    : ""}
                </small>
                <a
                  href={existing.decision.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read HMRC guidance ↗
                </a>
              </div>
            </div>
            <div className="receipt-facts">
              <span>
                Invoice total
                <strong>{money(existing.netPence + existing.vatPence)}</strong>
              </span>
              <span>
                VAT on invoice<strong>{money(existing.vatPence)}</strong>
              </span>
              <span>
                Recoverable VAT
                <strong>{money(existing.decision.reclaimPence)}</strong>
              </span>
            </div>
            <h4>Proposed journal</h4>
            {journal(existing).map((l) => (
              <div className="journal-line" key={l.account}>
                <span>{l.account}</span>
                <span>{l.debit ? money(l.debit) : "—"}</span>
                <span>{l.credit ? money(l.credit) : "—"}</span>
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
                existing.status === "posted" ||
                existing.decision.verdict === "review"
              }
              onClick={async () => {
                setBusy(true);
                try {
                  await onPost(existing);
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
              {existing.status === "posted"
                ? "Already in your books"
                : "Approve & post to books"}
            </Button>
          </div>
        ) : step === "reading" || (step === "review" && busy) ? (
          <div className="receipt-reading" aria-busy={busy}>
            <Saul state="thinking" />
            <div
              role="status"
              aria-live="polite"
              className="receipt-reading-status"
            >
              <h3>
                {busy
                  ? step === "reading"
                    ? "Saul is reading your receipt…"
                    : "Saul is checking the VAT details…"
                  : "Your receipt is ready to review."}
              </h3>
              <p>
                {busy
                  ? "Hang tight. The details will be ready for you to check."
                  : "Demo workspace · automatic extraction is available after sign-in. Enter the visible receipt details to continue."}
              </p>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            </div>
            {!live && !busy && (
              <Button
                onClick={() => {
                  setExtractNote(
                    "Demo: image attached. Enter the visible invoice details below; no automatic extraction has run.",
                  );
                  setStep("review");
                }}
              >
                Enter receipt details <ArrowRight />
              </Button>
            )}
          </div>
        ) : step === "upload" ? (
          <form
            onSubmit={readReceipt}
            className="receipt-form receipt-upload-form"
            aria-busy={busy}
          >
            <div className="upload-area">
              <Upload aria-hidden="true" />
              <Label htmlFor="receipt-image">
                Drop the paperwork. Keep the progress.
              </Label>
              <span>PNG, JPG or WebP · up to 4.5 MB</span>
              <Input
                id="receipt-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {image && <img src={image} alt="Uploaded receipt preview" />}
              {fileName && (
                <span className="receipt-file-name">{fileName}</span>
              )}
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy || !image}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              {busy ? "Preparing image…" : "Send receipt"}
            </Button>
            <div className="example-row">
              <span>Just exploring?</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setForm({ ...examples[0] });
                  setMissingAmounts([]);
                  setImage(undefined);
                  setFileName("");
                  setError("");
                  setExtractNote(
                    "Fictional sample receipt · review the details below.",
                  );
                  setStep("review");
                }}
              >
                Use sample receipt <ArrowRight size={13} />
              </Button>
            </div>
            <p className="hint">
              {live
                ? "Saul reads the image after you send it. You can review every field before saving."
                : "Demo workspace · automatic extraction is available after sign-in."}
            </p>
          </form>
        ) : (
          <form onSubmit={submit} className="receipt-form">
            {image && (
              <img
                className="receipt-review-image"
                src={image}
                alt="Uploaded receipt preview"
              />
            )}
            {extractNote && <p className="hint">{extractNote}</p>}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setStep("upload");
                setError("");
              }}
            >
              Choose another image
            </Button>
            <div className="form-grid">
              <div>
                <Label htmlFor="vendor">Supplier</Label>
                <Input
                  id="vendor"
                  value={form.vendor}
                  required
                  maxLength={160}
                  onChange={(e) => change("vendor", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="date">Invoice date</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => change("date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reference">Invoice reference</Label>
                <Input
                  id="reference"
                  value={form.reference}
                  onChange={(e) => change("reference", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => change("category", v as Category)}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Software",
                      "Office supplies",
                      "Client entertainment",
                      "Travel",
                      "Equipment",
                      "Other",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="net">Net amount (£)</Label>
                <Input
                  id="net"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={
                    missingAmounts.includes("netPence")
                      ? ""
                      : form.netPence / 100
                  }
                  onChange={(e) => {
                    change(
                      "netPence",
                      Math.round(Number(e.target.value) * 100),
                    );
                    setMissingAmounts((keys) =>
                      e.target.value === ""
                        ? [
                            ...keys.filter((key) => key !== "netPence"),
                            "netPence",
                          ]
                        : keys.filter((key) => key !== "netPence"),
                    );
                  }}
                />
              </div>
              <div>
                <Label htmlFor="vat">VAT amount (£)</Label>
                <Input
                  id="vat"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={
                    missingAmounts.includes("vatPence")
                      ? ""
                      : form.vatPence / 100
                  }
                  onChange={(e) => {
                    change(
                      "vatPence",
                      Math.round(Number(e.target.value) * 100),
                    );
                    setMissingAmounts((keys) =>
                      e.target.value === ""
                        ? [
                            ...keys.filter((key) => key !== "vatPence"),
                            "vatPence",
                          ]
                        : keys.filter((key) => key !== "vatPence"),
                    );
                  }}
                />
              </div>
              <div>
                <Label htmlFor="business">Business use (%)</Label>
                <Input
                  id="business"
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={form.businessPercent}
                  onChange={(e) =>
                    change("businessPercent", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <Label htmlFor="invoice">Valid VAT invoice?</Label>
                <Select
                  value={form.validInvoice ? "yes" : "no"}
                  onValueChange={(v) => change("validInvoice", v === "yes")}
                >
                  <SelectTrigger id="invoice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes, invoice available</SelectItem>
                    <SelectItem value="no">Not yet / unsure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Label htmlFor="notes">What was it for?</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => change("notes", e.target.value)}
              placeholder="Business purpose, who attended, anything Saul should know…"
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                busy ||
                !form.vendor.trim() ||
                !form.date ||
                missingAmounts.length > 0
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : <Check />}
              {busy ? "Reading the fine print…" : "Get VAT decision"}
            </Button>
            <p className="hint">
              {live
                ? "Your image is processed for extraction and classification; this version stores the extracted fields, not the original file."
                : "Demo workspace · sample rules · data stays in this browser."}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Upload, Loader2, Check, ArrowRight } from "lucide-react";
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
import { examples, type ReceiptInput, type Category } from "../domain";
import { extractReceipt } from "../services/workspace";
export default function ReceiptDialog({
  open,
  onClose,
  onAdd,
  live,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (r: ReceiptInput) => Promise<void>;
  live: boolean;
}) {
  const [form, setForm] = useState<ReceiptInput>({
      ...examples[0],
      vendor: "",
      reference: "",
      netPence: 0,
      vatPence: 0,
      notes: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [image, setImage] = useState<string>(),
    [extractNote, setExtractNote] = useState("");
  const change = (key: keyof ReceiptInput, value: unknown) =>
    setForm((p) => ({ ...p, [key]: value }));
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 4500000
    ) {
      setError("Choose a PNG, JPG or WebP image below 4.5 MB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    setImage(data);
    if (!live) {
      setExtractNote(
        "Demo: image attached. Enter the visible invoice details below; automatic extraction needs a configured backend.",
      );
      return;
    }
    setBusy(true);
    try {
      const d = await extractReceipt(data);
      if (d.currency && d.currency !== "GBP")
        throw Error("Only GBP receipts are supported in this first version.");
      setForm((p) => ({
        ...p,
        ...Object.fromEntries(
          Object.entries(d).filter(
            ([k, v]) =>
              v !== null &&
              ["vendor", "date", "reference", "netPence", "vatPence"].includes(
                k,
              ),
          ),
        ),
      }));
      setExtractNote(
        "Fields extracted. Check them against your invoice; missing fields still need your input.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      open={open}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="receipt-modal">
        <DialogHeader>
          <DialogTitle>Give your receipt a fair hearing.</DialogTitle>
          <DialogDescription>
            Add the facts. Saul will help you make sense of the VAT.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="receipt-form">
          <div className="upload-area">
            <Upload />
            <Label htmlFor="receipt-image">
              Drop the paperwork. Keep the progress.
            </Label>
            <span>PNG, JPG or WebP · up to 4.5 MB</span>
            <Input
              id="receipt-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            {image && <img src={image} alt="Uploaded receipt preview" />}
          </div>
          {extractNote && <p className="hint">{extractNote}</p>}
          <div className="example-row">
            <span>Just exploring?</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setForm({ ...examples[0] })}
            >
              Use sample receipt <ArrowRight size={13} />
            </Button>
          </div>
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
                value={form.netPence / 100}
                onChange={(e) =>
                  change("netPence", Math.round(Number(e.target.value) * 100))
                }
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
                value={form.vatPence / 100}
                onChange={(e) =>
                  change("vatPence", Math.round(Number(e.target.value) * 100))
                }
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
          <Button type="submit" disabled={busy || !form.vendor.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            {busy ? "Reading the fine print…" : "Get VAT decision"}
          </Button>
          <p className="hint">
            {live
              ? "Your image is processed for extraction and classification; this version stores the extracted fields, not the original file."
              : "Demo workspace · sample rules · data stays in this browser."}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  money,
  type Company,
  type Invoice,
  type InvoiceInput,
} from "../domain";
import {
  invoiceInputSchema,
  invoiceTotals,
  poundsToPence,
} from "../lib/invoices";

export default function InvoiceDialog({
  open,
  onClose,
  onCreate,
  company,
  live,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: InvoiceInput) => Promise<Invoice>;
  company: Company;
  live: boolean;
}) {
  const [fields, setFields] = useState({
    number: "",
    issueDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
    }).format(new Date()),
    dueDate: "",
    sellerAddress: "",
    customerName: "",
    customerAddress: "",
    notes: "",
    paymentDetails: "",
  });
  const [lines, setLines] = useState([
    {
      key: crypto.randomUUID(),
      description: "",
      quantity: "1",
      unit: "",
      vat: "0",
    },
  ]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = {
    ...fields,
    lines: lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPence: poundsToPence(l.unit) ?? -1,
      vatPence: poundsToPence(l.vat) ?? -1,
    })),
  };
  const parsed = invoiceInputSchema.safeParse(input);
  const vatAllowed =
    input.lines.every((l) => l.vatPence <= 0) ||
    (company.vatRegistered && !!company.vatNumber.trim());
  const update = (name: keyof typeof fields, value: string) =>
    setFields((prev) => ({ ...prev, [name]: value }));
  const updateLine = (
    index: number,
    field: "description" | "quantity" | "unit" | "vat",
    value: string,
  ) =>
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="receipt-modal invoice-modal">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>
            {live
              ? "Save a GBP draft with a downloadable PDF and a public URL anyone can view."
              : "Demo: fictional invoices are saved in this browser."}{" "}
            No ledger entry or payment is recorded.
          </DialogDescription>
        </DialogHeader>
        <form
          className="receipt-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!parsed.success || !vatAllowed || busy) return;
            setBusy(true);
            setError("");
            try {
              await onCreate(parsed.data);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="muted">
            From <strong>{company.name}</strong>
          </p>
          <div className="form-grid">
            <div>
              <Label htmlFor="invoice-number">Invoice number</Label>
              <Input
                id="invoice-number"
                required
                maxLength={50}
                placeholder="INV-001"
                value={fields.number}
                onChange={(e) => update("number", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-customer">Customer name</Label>
              <Input
                id="invoice-customer"
                required
                maxLength={160}
                value={fields.customerName}
                onChange={(e) => update("customerName", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-issued">Issue date</Label>
              <Input
                id="invoice-issued"
                type="date"
                required
                value={fields.issueDate}
                onChange={(e) => update("issueDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-due">Due date</Label>
              <Input
                id="invoice-due"
                type="date"
                required
                min={fields.issueDate}
                value={fields.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-seller-address">Seller address</Label>
              <Textarea
                id="invoice-seller-address"
                required
                maxLength={600}
                value={fields.sellerAddress}
                onChange={(e) => update("sellerAddress", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="invoice-customer-address">Customer address</Label>
              <Textarea
                id="invoice-customer-address"
                required
                maxLength={600}
                value={fields.customerAddress}
                onChange={(e) => update("customerAddress", e.target.value)}
              />
            </div>
          </div>
          {lines.map((line, index) => (
            <fieldset key={line.key} className="invoice-line">
              <legend>Item {index + 1}</legend>
              <div>
                <Label htmlFor={`description-${line.key}`}>
                  Description {index + 1}
                </Label>
                <Input
                  id={`description-${line.key}`}
                  required
                  maxLength={300}
                  value={line.description}
                  onChange={(e) =>
                    updateLine(index, "description", e.target.value)
                  }
                />
              </div>
              <div className="invoice-line-amounts">
                <div>
                  <Label htmlFor={`quantity-${line.key}`}>
                    Quantity {index + 1}
                  </Label>
                  <Input
                    id={`quantity-${line.key}`}
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, "quantity", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`unit-${line.key}`}>
                    Unit price (£) {index + 1}
                  </Label>
                  <Input
                    id={`unit-${line.key}`}
                    inputMode="decimal"
                    required
                    value={line.unit}
                    onChange={(e) => updateLine(index, "unit", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`vat-${line.key}`}>
                    Line VAT (£) {index + 1}
                  </Label>
                  <Input
                    id={`vat-${line.key}`}
                    inputMode="decimal"
                    required
                    value={line.vat}
                    onChange={(e) => updateLine(index, "vat", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={lines.length === 1 || busy}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={lines.length >= 50 || busy}
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  key: crypto.randomUUID(),
                  description: "",
                  quantity: "1",
                  unit: "",
                  vat: "0",
                },
              ])
            }
          >
            <Plus size={15} />
            Add item
          </Button>
          <Label htmlFor="invoice-payment">Payment details (optional)</Label>
          <Textarea
            id="invoice-payment"
            maxLength={600}
            value={fields.paymentDetails}
            onChange={(e) => update("paymentDetails", e.target.value)}
          />
          <Label htmlFor="invoice-notes">Notes (optional)</Label>
          <Textarea
            id="invoice-notes"
            maxLength={2000}
            value={fields.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
          <p className="hint">
            Enter VAT for the whole line explicitly. Use Latin characters for
            PDF text.
          </p>
          {!vatAllowed && (
            <p role="alert" className="error">
              Save VAT registration and a VAT number in Settings before charging
              VAT.
            </p>
          )}
          {!parsed.success && fields.number && (
            <p className="hint">{parsed.error.issues[0]?.message}</p>
          )}
          <p className="invoice-total">
            Total{" "}
            <strong>
              {parsed.success
                ? money(invoiceTotals(parsed.data).totalPence)
                : "—"}
            </strong>
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || !parsed.success || !vatAllowed}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Creating…" : "Create draft invoice"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

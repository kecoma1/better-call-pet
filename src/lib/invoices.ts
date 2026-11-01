import { z } from "zod";
import type { Company, Invoice, InvoiceInput } from "../domain.js";

const printable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),
      "Remove control characters.",
    )
    .refine(
      (s) =>
        [...s].every(
          (c) =>
            /[\n\r\t]/.test(c) ||
            /^[\u0020-\u007e\u00a0-\u00ff€–—‘’“”•]$/.test(c),
        ),
      "Use Latin characters supported by the PDF.",
    );
export const invoiceInputSchema = z
  .object({
    number: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 /_-]*$/),
    issueDate: z.iso.date(),
    dueDate: z.iso.date(),
    sellerAddress: printable(600).refine(Boolean, "Enter the seller address."),
    customerName: printable(160).refine(Boolean, "Enter the customer name."),
    customerAddress: printable(600).refine(
      Boolean,
      "Enter the customer address.",
    ),
    lines: z
      .array(
        z.object({
          description: printable(300).refine(Boolean, "Enter a description."),
          quantity: z.number().int().min(1).max(10000),
          unitPence: z.number().int().min(0).max(100000000),
          vatPence: z.number().int().min(0).max(20000000),
        }),
      )
      .min(1)
      .max(50),
    notes: printable(2000),
    paymentDetails: printable(600),
  })
  .refine(
    (v) => v.dueDate >= v.issueDate,
    "Due date cannot precede issue date.",
  )
  .refine(
    (v) =>
      invoiceTotals(v).totalPence > 0 &&
      invoiceTotals(v).totalPence <= 1000000000,
    "Invoice total must be between £0.01 and £10,000,000.",
  );
export function invoiceTotals(input: Pick<InvoiceInput, "lines">) {
  const netPence = input.lines.reduce(
    (s, l) => s + l.quantity * l.unitPence,
    0,
  );
  const vatPence = input.lines.reduce((s, l) => s + l.vatPence, 0);
  return { netPence, vatPence, totalPence: netPence + vatPence };
}
export function invoiceNumberKey(number: string) {
  return number.trim().replace(/\s+/g, " ").toUpperCase();
}
export function buildInvoice(
  input: InvoiceInput,
  company: Company,
  id: string,
  uid: string,
): Invoice {
  const data = invoiceInputSchema.parse(input);
  if (!company.vatRegistered && data.lines.some((l) => l.vatPence > 0))
    throw Error("A company that is not VAT registered cannot charge VAT.");
  if (data.lines.some((l) => l.vatPence > 0) && !company.vatNumber.trim())
    throw Error("Save the company's VAT number before charging VAT.");
  // Check the company text too, before persisting a draft that cannot be downloaded.
  printable(160).parse(company.name);
  printable(30).parse(company.vatNumber);
  printable(20).parse(company.number);
  return {
    ...data,
    id,
    status: "draft",
    currency: "GBP",
    seller: {
      name: company.name,
      number: company.number,
      vatRegistered: company.vatRegistered,
      vatNumber: company.vatNumber,
    },
    ...invoiceTotals(data),
    createdAt: new Date().toISOString(),
    createdBy: uid,
  };
}
export function poundsToPence(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= 100000000 ? result : null;
}
export function invoiceFilename(invoice: Pick<Invoice, "number">) {
  return "invoice-" + invoice.number.replace(/[^A-Za-z0-9_-]/g, "-") + ".pdf";
}
export function isInvoice(value: unknown): value is Invoice {
  if (!value || typeof value !== "object") return false;
  const v = value as Invoice;
  const parsed = invoiceInputSchema.safeParse(v);
  if (!parsed.success) return false;
  const totals = invoiceTotals(parsed.data);
  return (
    typeof v.id === "string" &&
    /^[a-f0-9]{32}$/.test(v.id) &&
    v.status === "draft" &&
    (v.demo === undefined || v.demo === true) &&
    v.currency === "GBP" &&
    typeof v.createdAt === "string" &&
    Number.isFinite(Date.parse(v.createdAt)) &&
    typeof v.createdBy === "string" &&
    !!v.seller &&
    typeof v.seller.name === "string" &&
    typeof v.seller.number === "string" &&
    typeof v.seller.vatNumber === "string" &&
    typeof v.seller.vatRegistered === "boolean" &&
    v.netPence === totals.netPence &&
    v.vatPence === totals.vatPence &&
    v.totalPence === totals.totalPence
  );
}

import { api } from "./api";
import type { Invoice, InvoiceDownload, InvoiceInput } from "../domain";
import { invoiceFilename, isInvoice } from "../lib/invoices";

export async function fetchInvoices(signal?: AbortSignal): Promise<Invoice[]> {
  const data: unknown = await api("/invoices", undefined, signal);
  if (!Array.isArray(data) || !data.every(isInvoice))
    throw Error("The invoice response was incomplete.");
  return data;
}
export async function createInvoice(input: InvoiceInput): Promise<Invoice> {
  const data: unknown = await api("/invoices", input);
  if (!isInvoice(data)) throw Error("No valid invoice was returned.");
  return data;
}
export async function getInvoiceDownload(
  invoice: Invoice,
  live: boolean,
  signal?: AbortSignal,
): Promise<InvoiceDownload> {
  if (!live) {
    const { generateInvoicePdf } = await import("../lib/invoice-pdf");
    const bytes = await generateInvoicePdf(invoice, true);
    signal?.throwIfAborted();
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    );
    return { url, filename: invoiceFilename(invoice), publicUrl: "" };
  }
  const data = await api("/invoices/download", { id: invoice.id }, signal);
  let url: URL;
  try {
    url = new URL(data?.url);
  } catch {
    throw Error("No valid download link was returned.");
  }
  if (
    url.origin !== "https://rent-o-accountant.web.app" ||
    !/^\/api\/invoices\/public\/[A-Za-z0-9_-]{43}$/.test(url.pathname) ||
    url.search !== "?download=1" ||
    url.hash ||
    url.username ||
    url.password ||
    data.filename !== invoiceFilename(invoice) ||
    data.publicUrl !== url.origin + url.pathname
  )
    throw Error("No valid download link was returned.");
  return data;
}

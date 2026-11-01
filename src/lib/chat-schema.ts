import { z } from "zod";

export const toolSchema = z.object({
  name: z.enum(["list_receipts", "get_company", "create_receipt", "save_company", "list_invoices", "create_invoice", "get_invoice_download", "download_invoice"]),
  invoices: z.array(z.object({
    id: z.string().min(1), number: z.string(), customerName: z.string(),
    totalPence: z.number().int().nonnegative(), status: z.literal("draft"),
  })).max(20).optional(),
  invoiceCount: z.number().int().nonnegative().optional(),
  download: z.object({
    url: z.url().startsWith("https://rent-o-accountant.web.app/api/invoices/public/"),
    publicUrl: z.url().startsWith("https://rent-o-accountant.web.app/api/invoices/public/"),
    filename: z.string(),
  }).optional(),
  receipts: z.array(z.object({
    id: z.string().min(1),
    vendor: z.string(),
    netPence: z.number().int().nonnegative(),
    vatPence: z.number().int().nonnegative(),
    status: z.enum(["review", "posted"]),
  })).optional(),
  receiptCount: z.number().int().nonnegative().optional(),
  company: z.object({
    name: z.string(),
    vatRegistered: z.boolean(),
    yearEnd: z.string(),
  }).optional(),
});

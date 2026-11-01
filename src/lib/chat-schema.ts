import { z } from "zod";

export const toolSchema = z.object({
  name: z.enum(["list_receipts", "get_company", "create_receipt", "save_company"]),
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

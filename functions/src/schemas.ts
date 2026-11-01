import { z } from "zod";
export const receiptSchema = z.object({
  vendor: z.string().trim().min(1).max(160),
  date: z.iso.date(),
  reference: z.string().trim().max(100),
  netPence: z.number().int().min(0).max(100000000),
  vatPence: z.number().int().min(0).max(20000000),
  category: z.enum([
    "Software",
    "Office supplies",
    "Client entertainment",
    "Travel",
    "Equipment",
    "Other",
  ]),
  businessPercent: z.number().int().min(0).max(100),
  validInvoice: z.boolean(),
  notes: z.string().max(3000),
  image: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .max(7000000)
    .optional(),
});
export const companySchema = z.object({
  name: z.string().trim().min(1).max(160),
  number: z.string().max(20),
  utr: z.string().max(20),
  yearEnd: z.iso.date(),
  tradingStart: z.iso.date(),
  vatRegistered: z.boolean(),
  vatNumber: z.string().max(30),
  vatScheme: z.enum(["standard", "flat_rate"]),
});

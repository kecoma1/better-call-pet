import { api } from "./api";
import { z } from "zod";
import type { Company, Receipt, ReceiptInput } from "../domain";

const extractedReceiptSchema = z.object({
  vendor: z.string().max(160).nullable(),
  date: z.iso.date().nullable(),
  reference: z.string().nullable(),
  netPence: z.number().int().nonnegative().nullable(),
  vatPence: z.number().int().nonnegative().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
});
export async function fetchWorkspace(
  signal?: AbortSignal,
): Promise<{ company: Company; receipts: Receipt[] }> {
  const data = await api("/workspace", undefined, signal);
  if (!data || !data.company || !Array.isArray(data.receipts))
    throw Error("The workspace response was incomplete.");
  return data;
}
export async function saveCompany(company: Company) {
  return api("/company", company);
}
export async function createReceipt(receipt: ReceiptInput): Promise<Receipt> {
  const d = await api("/receipts", receipt);
  if (!d?.id || !d.decision) throw Error("No receipt was returned.");
  return d;
}
export async function postReceipt(id: string) {
  return api("/receipts/post", { id });
}
export async function extractReceipt(image: string) {
  const result = extractedReceiptSchema.safeParse(
    await api("/extract", { image }),
  );
  if (!result.success)
    throw Error("Saul returned incomplete receipt data. Please try again.");
  return result.data;
}
export async function fetchConnections(signal?: AbortSignal) {
  const d = await api("/connections", undefined, signal);
  if (!Array.isArray(d)) throw Error("Could not load connections.");
  return d as { id: string; name: string; scope: string }[];
}
export async function revokeConnection(id: string) {
  return api("/connections/revoke", { id });
}
export async function previewConsent(query: Record<string, string>) {
  return api("/oauth/preview", query);
}
export async function approveConsent(query: Record<string, string>) {
  return api("/oauth/approve", query);
}

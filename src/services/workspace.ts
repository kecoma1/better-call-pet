import { api } from "./api";
import type { Company, Receipt, ReceiptInput } from "../domain";
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
  return api("/extract", { image });
}
export async function sendChat(
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const d = await api("/chat", { messages });
  if (typeof d.message !== "string")
    throw Error("Saul could not finish his reply.");
  return d.message as string;
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

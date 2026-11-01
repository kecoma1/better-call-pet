import { getFirestore } from "firebase-admin/firestore";
import { createHash, randomBytes } from "node:crypto";
import type {
  Invoice,
  InvoiceInput,
  InvoiceDownload,
} from "../../src/domain.js";
import {
  buildInvoice,
  invoiceFilename,
  invoiceInputSchema,
  invoiceNumberKey,
} from "../../src/lib/invoices.js";
import { company } from "./company.js";
import { hash, origin } from "./oauth.js";
import { actorUid, isDemo, workspaceDocument, workspaceFields, workspaceList, type WorkspaceActor } from "./workspace-context.js";

const db = () => getFirestore();
export async function listInvoices(uid: WorkspaceActor): Promise<Invoice[]> {
  return (
    await workspaceList("invoices", uid).get()
  ).docs.map((d) => {
    const {
      fingerprint: _fingerprint,
      publicToken: _publicToken,
      workspaceId: _workspaceId,
      ...invoice
    } = d.data();
    return invoice as Invoice;
  });
}
export async function getInvoice(uid: WorkspaceActor, id: string): Promise<Invoice> {
  const data = (await workspaceDocument("invoices", id, uid).get()).data();
  if (!data) throw Error("Invoice not found.");
  const {
    fingerprint: _fingerprint,
    publicToken: _publicToken,
    workspaceId: _workspaceId,
    ...invoice
  } = data;
  return invoice as Invoice;
}
export async function createInvoice(
  uid: WorkspaceActor,
  input: InvoiceInput,
): Promise<Invoice> {
  const data = invoiceInputSchema.parse(input);
  const id = createHash("sha256")
    .update(invoiceNumberKey(data.number))
    .digest("hex")
    .slice(0, 32);
  const ref = workspaceDocument("invoices", id, uid);
  const fingerprint = hash(
    JSON.stringify({ ...data, number: invoiceNumberKey(data.number) }),
  );
  const c = await company(uid);
  return db().runTransaction(async (tx) => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw Error(
          "This invoice number is already in use with different details.",
        );
      const {
        fingerprint: _fingerprint,
        publicToken: _publicToken,
        workspaceId: _workspaceId,
        ...invoice
      } = existing;
      return invoice as Invoice;
    }
    const invoice = { ...buildInvoice(data, c, id, actorUid(uid)), ...(isDemo(uid) ? { demo: true as const } : {}) };
    const publicToken = randomBytes(32).toString("base64url");
    tx.create(db().collection("invoiceLinks").doc(hash(publicToken)), {
      invoiceId: id,
      ...(isDemo(uid) ? { demoUid: actorUid(uid) } : {}),
    });
    tx.create(ref, { ...invoice, fingerprint, publicToken, ...workspaceFields(uid) });
    console.info("invoice.created", { uid: actorUid(uid), invoiceId: id });
    return invoice;
  });
}
export async function invoiceDownload(
  uid: WorkspaceActor,
  id: string,
): Promise<InvoiceDownload> {
  const data = (await workspaceDocument("invoices", id, uid).get()).data();
  if (!data || typeof data.publicToken !== "string")
    throw Error("Invoice not found.");
  const publicUrl = origin + "/api/invoices/public/" + data.publicToken;
  console.info("invoice.links_read", { uid: actorUid(uid), invoiceId: id });
  return {
    url: publicUrl + "?download=1",
    publicUrl,
    filename: invoiceFilename(data as Invoice),
  };
}
export async function resolvePublicInvoice(token: string): Promise<Invoice> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw Error("Invoice not found.");
  const link = (
    await db().collection("invoiceLinks").doc(hash(token)).get()
  ).data();
  if (!link) throw Error("Invoice not found.");
  const actor: WorkspaceActor = typeof link.demoUid === "string" ? { uid: link.demoUid, demo: true } : "";
  const data = (await workspaceDocument("invoices", link.invoiceId, actor).get()).data();
  if (!data || data.publicToken !== token) throw Error("Invoice not found.");
  const {
    fingerprint: _fingerprint,
    publicToken: _publicToken,
    workspaceId: _workspaceId,
    ...invoice
  } = data;
  return invoice as Invoice;
}

import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { defaultCompany, demoReceipts, duplicateKey, journal } from "../../src/domain.js";
import { workspaceDocument, workspaceFields, type WorkspaceActor } from "./workspace-context.js";

export async function ensureDemoWorkspace(actor: WorkspaceActor) {
  if (typeof actor === "string") return;
  const company = workspaceDocument("companies", "primary", actor);
  await getFirestore().runTransaction(async (tx) => {
    if ((await tx.get(company)).exists) return;
    tx.create(company, { ...defaultCompany, ...workspaceFields(actor) });
    for (const sample of demoReceipts) {
      const id = createHash("sha256").update(duplicateKey(sample)).digest("hex").slice(0, 32);
      const receipt = { ...sample, id, ...workspaceFields(actor) };
      tx.create(workspaceDocument("expenses", id, actor), receipt);
      if (receipt.status === "posted")
        tx.create(workspaceDocument("journals", id, actor), {
          receiptId: id, date: receipt.date, lines: journal(receipt),
          createdAt: receipt.createdAt, ...workspaceFields(actor),
        });
    }
  });
}

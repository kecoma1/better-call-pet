// Opt-in paid provider check. Every database read/write is isolated in memory.
// No browser, production accounting data or production membership is involved.
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ docs: new Map<string, any>() }));
vi.mock("firebase-admin/firestore", async () => {
  const { memoryFirestore } = await import("../tests/helpers/firestore");
  const db = memoryFirestore(state.docs);
  return { getFirestore: () => db };
});
import { setTracingDisabled } from "@openai/agents";
import { sendConversationMessage } from "../src/chat";
import { sharedTools } from "../src/tools";
import { defaultCompany } from "../../src/domain";

setTracingDisabled(true);
const enabled = process.env.BCP_LIVE_TOOLS === "1" && !!process.env.OPENAI_API_KEY;
beforeEach(() => {
  state.docs.clear();
  state.docs.set("users/synthetic-tool-check", { active: true });
  state.docs.set("companies/primary", defaultCompany);
});
it.skipIf(!enabled).each([
  { count: 3, message: "Crea unos receipts random para la demo del evento." },
  { count: 5, message: "Crea cinco receipts random para la demo del evento." },
])("creates $count random test receipts with the live model and Decisions, then lists them", async ({ count, message }) => {
  const uid = "synthetic-tool-check";
  const tools = sharedTools(uid);
  const company = { ...defaultCompany, name: "Fictional OpenAI Event LTD" };
  await tools.find((tool) => tool.name === "save_company")!.execute(company);
  expect(await tools.find((tool) => tool.name === "get_company")!.execute({})).toEqual(company);
  const input = { conversationId: crypto.randomUUID(), requestId: crypto.randomUUID(), message };
  const created = await sendConversationMessage(uid, input);
  const drafts = [...state.docs.entries()].filter(([key]) => key.startsWith("expenses/")).map(([, data]) => data);
  expect(drafts).toHaveLength(count);
  for (const draft of drafts) {
    expect(draft).toMatchObject({ status: "review", validInvoice: false, decision: { reclaimPence: 0, provider: "openai-decisions" } });
    expect(draft.notes).toMatch(/^SYNTHETIC TEST DATA/);
    expect(Number.isInteger(draft.netPence)).toBe(true);
  }
  const reply = created.messages.at(-1)!;
  expect(reply.tools?.filter((tool) => tool.name === "create_receipt")).toHaveLength(count);
  expect(reply.activity?.some((event) => event.kind === "tool_failed")).toBe(false);
  expect(await sendConversationMessage(uid, input)).toEqual(created);
  const listed = await sendConversationMessage(uid, { ...input, requestId: crypto.randomUUID(), message: "Lista los receipts que acabas de crear y dime cuáles necesitan revisión." });
  expect(listed.messages.at(-1)!.tools?.some((tool) => tool.name === "list_receipts" && tool.receiptCount === count)).toBe(true);
  expect(listed.messages.at(-1)!.activity?.some((event) => event.kind === "tool_failed")).toBe(false);
  expect([...state.docs.keys()].some((key) => key.startsWith("journals/"))).toBe(false);
  // Log only bounded public results from synthetic fixtures, never provider payloads.
  console.log(JSON.stringify({ draftCount: drafts.length, reply: reply.content, followUp: listed.messages.at(-1)!.content }));
}, 180000);

it.skipIf(!enabled)("saves a fictional demo company without asking for real legal details", async () => {
  const input = { conversationId: crypto.randomUUID(), requestId: crypto.randomUUID(), message: "Guarda una empresa ficticia para la demo. Invéntate el nombre y fechas y usa valores de ejemplo. No tengo datos legales reales." };
  const saved = await sendConversationMessage("synthetic-tool-check", input);
  const company = state.docs.get("companies/primary");
  expect(company.name).toMatch(/^DEMO/);
  expect(company.number).toBe("");
  expect(company.utr).toBe("");
  expect(company.vatNumber).toBe("");
  expect(saved.messages.at(-1)!.tools?.some((tool) => tool.name === "save_company")).toBe(true);
  expect(saved.messages.at(-1)!.activity?.some((event) => event.kind === "tool_failed")).toBe(false);
}, 120000);

it.skipIf(!enabled)("illustrates an invented accounting scenario without saving records", async () => {
  const input = { conversationId: crypto.randomUUID(), requestId: crypto.randomUUID(), message: "Para la demo, inventa un ejemplo de ingresos y gastos de una empresa ficticia y calcula su beneficio. Solo una simulación, no guardes nada." };
  const saved = await sendConversationMessage("synthetic-tool-check", input);
  const reply = saved.messages.at(-1)!;
  expect(reply.content).toMatch(/demo|fictici|simula|ejemplo/i);
  expect(reply.content).toMatch(/\d/);
  expect(reply.tools?.some((tool) => tool.name === "create_receipt" || tool.name === "save_company")).not.toBe(true);
  expect(state.docs.get("companies/primary")).toEqual(defaultCompany);
  expect([...state.docs.keys()].some((key) => key.startsWith("expenses/") || key.startsWith("journals/"))).toBe(false);
}, 120000);

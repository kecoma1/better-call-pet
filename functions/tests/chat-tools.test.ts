import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  outputs: [] as any[],
  requests: [] as any[],
  models: [] as string[],
  decide: vi.fn(),
}));
vi.mock("firebase-admin/firestore", async () => {
  const { memoryFirestore } = await import("./helpers/firestore");
  const db = memoryFirestore(state.docs);
  return { getFirestore: () => db };
});
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: async (token: string) => {
    if (token !== "fixture-member-token") throw Error("Invalid token");
    return { uid: "member" };
  } }),
}));
// Keep Agent, tool parsing, invocation, streaming and Runner real. Only replace
// the remote model provider with a deterministic script (no network or API key).
vi.mock("@openai/agents", async (importOriginal) => {
  const sdk = await importOriginal<typeof import("@openai/agents")>();
  const model = {
    async getResponse(request: any) {
      state.requests.push(request);
      const output = state.outputs.shift();
      if (output instanceof Error) throw output;
      if (!output) throw Error("Unexpected extra model request");
      return { output, usage: new sdk.Usage() };
    },
    async *getStreamedResponse(request: any) {
      const response = await this.getResponse(request);
      yield { type: "response_started" as const };
      for (const item of response.output)
        if (item.type === "message")
          for (const part of item.content)
            yield { type: "output_text_delta" as const, delta: part.text };
      yield { type: "response_done" as const, response: { ...response, id: `fixture-${state.requests.length}` } };
    },
  };
  return {
    ...sdk,
    run: (agent: any, input: any, options: any) => new sdk.Runner({
      tracingDisabled: true,
      modelProvider: { getModel: async (name: string) => { state.models.push(name); return model; } },
    }).run(agent, input, options),
  };
});
import app from "../src/app";
import { replyToConversation, sendConversationMessage } from "../src/chat";
import { hash } from "../src/oauth";
import { defaultCompany, examples } from "../../src/domain";

const httpFetch = globalThis.fetch;
const assistant = (text: string) => [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text }] }];
const call = (name: string, args: unknown, id = name) => ({ type: "function_call", callId: id, name, arguments: JSON.stringify(args) });
const request = () => ({ conversationId: crypto.randomUUID(), requestId: crypto.randomUUID(), message: "Crea tres receipts ficticios para el evento." });
const synthetic = (index: number) => ({ ...examples[index % examples.length], vendor: `Fictional Vendor ${index}`, reference: `SYNTHETIC-${index}`, validInvoice: false, notes: "SYNTHETIC TEST DATA — OpenAI event demo." });
const expenseRows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("expenses/"));
let server: Server, base: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  state.docs.clear(); state.outputs = []; state.requests = []; state.models = [];
  state.docs.set("users/member", { active: true });
  state.docs.set("companies/primary", defaultCompany);
  state.decide.mockReset().mockImplementation(async () => new Response(JSON.stringify({ answers: [{ name: "vat_recovery", type: "choice", choice: "deductible", confidence: 0.99 }] })));
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).startsWith(base)) return httpFetch(url, init);
    expect(url).toBe("https://api.openai.com/v1/decisions");
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe("gpt-6-luna");
    if (body.questions[0].name === "conversation_topic")
      return new Response(JSON.stringify({ answers: [{ name: "conversation_topic", type: "choice", choice: "Receipts" }] }));
    return state.decide(url, init);
  });
});

describe("chat with the real Agents SDK and shared tools", () => {
  it("creates three synthetic drafts in parallel, streams real tool cards and replays retries once", async () => {
    state.outputs.push([0, 1, 2].map((index) => call("create_receipt", synthetic(index), `create-${index}`)), assistant("He creado tres borradores ficticios para revisar."));
    const input = request();
    const saved = await sendConversationMessage("member", input);
    const reply = saved.messages.at(-1)!;
    expect(reply.tools).toHaveLength(3);
    expect(reply.tools!.every((tool) => tool.name === "create_receipt" && tool.receipts?.[0].status === "review")).toBe(true);
    expect(reply.activity!.filter((event) => event.kind === "tool_completed")).toHaveLength(3);
    expect(reply.activity!.some((event) => event.kind === "tool_failed")).toBe(false);
    expect(expenseRows()).toHaveLength(3);
    for (const [, receipt] of expenseRows()) {
      expect(receipt).toMatchObject({ status: "review", validInvoice: false, decision: { verdict: "review", reclaimPence: 0 } });
      expect(receipt.notes).toContain("SYNTHETIC TEST DATA");
    }
    const run = state.docs.get(`chatRuns/${input.requestId}`);
    expect(run).toMatchObject({ status: "completed", content: reply.content });
    expect(run.tools).toEqual(reply.tools);
    expect(run.events.at(-1).kind).toBe("completed");
    expect(await sendConversationMessage("member", input)).toEqual(saved);
    expect(state.decide).toHaveBeenCalledTimes(3);
    expect(state.requests).toHaveLength(2);
    expect(state.models.every((name) => name === "gpt-6-luna")).toBe(true);
    expect([...state.docs.keys()].some((key) => key.startsWith("journals/"))).toBe(false);
  });
  it("passes strict real tool schemas and the synthetic-data permission to the model, without eager lookups", async () => {
    state.outputs.push(assistant("¡Hola!"));
    const reply = await replyToConversation("member", [{ role: "user", content: "Hola" }]);
    expect(reply.tools).toBeUndefined();
    expect(state.decide).not.toHaveBeenCalled();
    const model = state.requests[0];
    expect(model.systemInstructions).toContain("explicitly requested fake");
    expect(model.systemInstructions).toContain("SYNTHETIC TEST DATA");
    expect(model.tools.map((tool: any) => tool.name)).toEqual(["list_receipts", "get_company", "create_receipt", "save_company", "list_invoices", "create_invoice", "get_invoice_download", "download_invoice"]);
    for (const tool of model.tools) {
      expect(tool.strict).toBe(true);
      expect(tool.parameters).toMatchObject({ type: "object", additionalProperties: false });
    }
  });
  it("runs company reads, saves and receipt listing through the same SDK adapter", async () => {
    const company = { ...defaultCompany, name: "Synthetic Event LTD" };
    state.outputs.push([call("get_company", {}), call("list_receipts", {})], [call("save_company", company)], assistant("Configuración de prueba guardada."));
    const saved = await sendConversationMessage("member", request());
    expect(state.docs.get("companies/primary")).toEqual(company);
    expect(saved.messages.at(-1)!.tools?.map((tool) => tool.name)).toEqual(["get_company", "list_receipts", "save_company"]);
    expect(saved.messages.at(-1)!.tools?.[1]).toMatchObject({ receiptCount: 0, receipts: [] });
    expect(saved.messages.at(-1)!.tools?.[2].company).toEqual({ name: company.name, vatRegistered: true, yearEnd: company.yearEnd });
  });
  it("keeps successful drafts and cards when another tool fails", async () => {
    state.decide.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    state.outputs.push([call("create_receipt", synthetic(0), "failed"), call("create_receipt", synthetic(1), "created")], assistant("Un borrador creado; el otro ha fallado."));
    const saved = await sendConversationMessage("member", request());
    expect(expenseRows()).toHaveLength(1);
    expect(saved.messages.at(-1)!.tools).toHaveLength(1);
    const kinds = saved.messages.at(-1)!.activity!.map((event) => event.kind);
    expect(kinds).toContain("tool_failed");
    expect(kinds).toContain("tool_completed");
    const results = state.requests[1].input.filter((item: any) => item.type === "function_call_result");
    expect(results).toHaveLength(2);
  });
  it("validates SDK arguments before execution and rechecks membership before mutations", async () => {
    state.outputs.push([call("create_receipt", { ...synthetic(0), netPence: 1.5 })], assistant("Importe inválido."));
    await sendConversationMessage("member", request());
    expect(expenseRows()).toHaveLength(0);
    expect(state.decide).not.toHaveBeenCalled();
    state.docs.set("users/member", { active: false });
    state.outputs.push([call("create_receipt", synthetic(1))], assistant("Acceso desactivado."));
    const saved = await sendConversationMessage("member", request());
    expect(expenseRows()).toHaveLength(0);
    expect(state.decide).not.toHaveBeenCalled();
    expect(saved.messages.at(-1)!.activity!.some((event) => event.kind === "tool_failed")).toBe(true);
  });
  it("releases the send lease on a stream failure and retains completed mutations in the failed run", async () => {
    state.outputs.push([call("create_receipt", synthetic(0))], Error("Private provider failure"));
    const input = request();
    await expect(sendConversationMessage("member", input)).rejects.toThrow("Saul could not finish");
    expect(state.docs.has(`conversations/${input.conversationId}`)).toBe(false);
    expect(expenseRows()).toHaveLength(1);
    expect(state.docs.get(`chatRuns/${input.requestId}`)).toMatchObject({ status: "failed", tools: [{ name: "create_receipt" }] });
    state.outputs.push(assistant("Puedes continuar."));
    await expect(sendConversationMessage("member", { ...input, requestId: crypto.randomUUID() })).resolves.toMatchObject({ id: input.conversationId });
  });
});

describe("authenticated chat and MCP tool routing", () => {
  it("rejects missing identity and inactive members before chat providers run", async () => {
    for (const token of [undefined, "fixture-member-token"]) {
      if (token) state.docs.set("users/member", { active: false });
      const response = await httpFetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(request()) });
      expect(response.status).toBe(401);
    }
    expect(state.requests).toHaveLength(0);
    expect(state.decide).not.toHaveBeenCalled();
  });
  it("returns the saved receipt card from the real authenticated chat route", async () => {
    state.outputs.push([call("create_receipt", synthetic(0))], assistant("Borrador ficticio creado."));
    const response = await httpFetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fixture-member-token" }, body: JSON.stringify(request()) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message).toBe("Borrador ficticio creado.");
    expect(body.conversation.messages.at(-1).tools[0]).toMatchObject({ name: "create_receipt", receiptCount: 1 });
    expect(expenseRows()).toHaveLength(1);
  });
  async function mcp(scope: string, method: string, params: unknown = {}) {
    state.docs.set(`oauthAccess/${hash("fixture-oauth-token")}`, { uid: "member", resource: "https://rent-o-accountant.web.app/mcp", expiresAt: Date.now() + 60000, connectionId: "fixture", scope });
    state.docs.set("oauthConnections/fixture", { revoked: false });
    const response = await httpFetch(base + "/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer fixture-oauth-token" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    return response.json();
  }
  it("filters MCP tools by current OAuth scopes and executes the same validated create tool", async () => {
    const read = await mcp("accounts:read", "tools/list");
    expect(read.result.tools.map((tool: any) => tool.name)).toEqual(["list_receipts", "get_company", "list_invoices", "get_invoice_download", "download_invoice"]);
    const denied = await mcp("accounts:read", "tools/call", { name: "create_receipt", arguments: synthetic(0) });
    expect(denied.error ?? denied.result?.isError).toBeTruthy();
    expect(expenseRows()).toHaveLength(0);
    const write = await mcp("receipts:write", "tools/list");
    expect(write.result.tools.map((tool: any) => tool.name)).toEqual(["create_receipt", "save_company"]);
    const created = await mcp("receipts:write", "tools/call", { name: "create_receipt", arguments: synthetic(0) });
    expect(created.result.isError).not.toBe(true);
    expect(JSON.parse(created.result.content[0].text)).toMatchObject({ status: "review", validInvoice: false });
    expect(expenseRows()).toHaveLength(1);
  });
});

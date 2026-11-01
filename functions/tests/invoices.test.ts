import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import type { Server } from "node:http";
const state = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  agent: null as any,
}));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", () => {
  const snap = (key: string) => ({
    exists: state.docs.has(key),
    data: () => state.docs.get(key),
  });
  const ref = (key: string) => ({
    key,
    get: async () => snap(key),
    set: async (data: any) => {
      state.docs.set(key, data);
    },
  });
  return {
    getFirestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ref(name + "/" + id),
        where: (field: string, _op: string, value: string) => ({
          orderBy: () => ({ limit: () => ({ get: async () => ({
            docs: [...state.docs.keys()].filter((k) => k.startsWith(name + "/") && state.docs.get(k)?.[field] === value).map(snap),
          }) }) }),
        }),
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              docs: [...state.docs.keys()]
                .filter((k) => k.startsWith(name + "/"))
                .map(snap),
            }),
          }),
        }),
      }),
      runTransaction: async (fn: any) => {
        const writes: (() => void)[] = [];
        const result = await fn({
          get: async (r: any) => snap(r.key),
          create: (r: any, data: any) => {
            if (state.docs.has(r.key)) throw Error("Already exists");
            writes.push(() => state.docs.set(r.key, data));
          },
          set: (r: any, data: any) =>
            writes.push(() => state.docs.set(r.key, data)),
          update: (r: any, data: any) =>
            writes.push(() => state.docs.set(r.key, { ...state.docs.get(r.key), ...data })),
        });
        writes.forEach((write) => write());
        return result;
      },
    }),
  };
});
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token === "demo-a" || token === "demo-b")
        return { uid: token, firebase: { sign_in_provider: "anonymous" } };
      if (token !== "firebase-ok") throw Error("Invalid token");
      return { uid: "member" };
    },
    getUser: async () => ({ disabled: false, providerData: [] }),
  }),
}));
vi.mock("@openai/agents", () => ({
  setTracingDisabled: vi.fn(),
  tool: (config: any) => config,
  Agent: class {
    constructor(config: any) {
      state.agent = config;
    }
  },
  run: async () => ({
    finalOutput: await state.agent.tools
      .find((t: any) => t.name === "create_invoice")
      .execute(invoiceInput),
  }),
}));
import app from "../src/app";
import {
  createInvoice,
  invoiceDownload,
  resolvePublicInvoice,
} from "../src/invoices";
import { sharedTools } from "../src/tools";
import { hash } from "../src/oauth";
import { defaultCompany, examples } from "../../src/domain";
import { invoiceInput } from "../../tests/fixtures/invoice";
let server: Server, base: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    ),
);
beforeEach(() => {
  state.docs.clear();
  state.docs.set("users/member", { active: true });
  state.docs.set("companies/primary", {
    ...defaultCompany,
    vatNumber: "GB000000000",
    utr: "never-publish-this",
  });
  state.docs.set("oauthAccess/" + hash("mcp-token"), {
    uid: "member",
    expiresAt: Date.now() + 10000,
    resource: "https://rent-o-accountant.web.app/mcp",
    connectionId: "connection",
    scope: "accounts:read invoices:write",
  });
  state.docs.set("oauthConnections/connection", { revoked: false });
});
const post = (path: string, body: unknown, token = "firebase-ok") =>
  fetch(base + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
const rpc = (method: string, params: unknown) =>
  post("/mcp", { jsonrpc: "2.0", id: 1, method, params }, "mcp-token");
const get = (path: string, token: string) => fetch(base + path, { headers: { Authorization: "Bearer " + token } });
describe("invoice API, shared agent tools and MCP", () => {
  it("opens persistent isolated anonymous workspaces without internal membership", async () => {
    const first = await (await get("/api/workspace", "demo-a")).json();
    expect(first.company.name).toBe(defaultCompany.name);
    expect(first.receipts).toHaveLength(3);
    expect([...state.docs.keys()].some((k) => k.startsWith("users/demo-"))).toBe(false);
    await post("/api/company", { ...first.company, name: "Guest A Ltd", vatNumber: "GB000000000" }, "demo-a");
    const created = await (await post("/api/invoices", invoiceInput, "demo-a")).json();
    expect(created.demo).toBe(true);
    const other = await (await get("/api/workspace", "demo-b")).json();
    expect(other.company.name).toBe(defaultCompany.name);
    expect(await (await get("/api/invoices", "demo-b")).json()).toEqual([]);
    expect((await post("/api/invoices/download", { id: created.id }, "demo-b")).status).toBe(400);
    const restored = await (await get("/api/workspace", "demo-a")).json();
    expect(restored.company.name).toBe("Guest A Ltd");
    expect(await (await get("/api/invoices", "demo-a")).json()).toHaveLength(1);
    expect(await (await get("/api/invoices", "firebase-ok")).json()).toEqual([]);
    expect(state.docs.get("companies/primary").name).toBe(defaultCompany.name);
    const links = await (await post("/api/invoices/download", { id: created.id }, "demo-a")).json();
    const pdf = await fetch(base + new URL(links.publicUrl).pathname);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect((await resolvePublicInvoice(links.publicUrl.split("/").at(-1))).demo).toBe(true);
    // The explicit OAuth boundary continues to require an internal account.
    expect((await get("/api/connections", "demo-a")).status).toBe(401);
  });
  it("uses real Decisions for anonymous receipts, posts atomically and refuses cross-workspace posting", async () => {
    const network = globalThis.fetch;
    const decisions = vi.spyOn(globalThis, "fetch").mockImplementation((input, options) =>
      String(input) === "https://api.openai.com/v1/decisions"
        ? Promise.resolve(new Response(JSON.stringify({ id: "decision-demo", answers: [{ name: "vat_recovery", type: "choice", choice: "deductible", confidence: 0.99 }] })))
        : network(input, options));
    vi.stubEnv("OPENAI_API_KEY", "fixture-key");
    try {
      const response = await post("/api/receipts", { ...examples[0], reference: "new-demo" }, "demo-a");
      expect(response.status).toBe(200);
      const receipt = await response.json();
      expect(receipt.decision.provider).toBe("openai-decisions");
      expect(receipt.status).toBe("review");
      expect((await post("/api/receipts/post", { id: receipt.id }, "demo-b")).status).toBe(400);
      expect((await post("/api/receipts/post", { id: receipt.id }, "demo-a")).status).toBe(200);
      expect((await post("/api/receipts/post", { id: receipt.id }, "demo-a")).status).toBe(200);
      expect([...state.docs.entries()].filter(([key, value]) => key.startsWith("demoJournals/") && value.receiptId === receipt.id)).toHaveLength(1);
      expect([...state.docs.keys()].some((k) => k.startsWith("expenses/") || k.startsWith("journals/"))).toBe(false);
      decisions.mockImplementation((input, options) => String(input) === "https://api.openai.com/v1/decisions" ? Promise.resolve(new Response("{}", { status: 503 })) : network(input, options));
      expect((await post("/api/receipts", { ...examples[0], reference: "provider-failed" }, "demo-a")).status).toBe(400);
      const saved = await (await get("/api/workspace", "demo-a")).json();
      expect(saved.receipts.some((r: any) => r.reference === "provider-failed")).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });
  it("persists anonymous chat and agent-created invoices without touching another workspace", async () => {
    await post("/api/company", { ...defaultCompany, vatNumber: "GB000000000" }, "demo-a");
    const response = await post("/api/chat", { messages: [{ role: "user", content: "Create this invoice" }] }, "demo-a");
    expect(response.status).toBe(200);
    expect(JSON.parse((await response.json()).message).invoice.demo).toBe(true);
    const messages = [{ role: "user", content: "Hello from the demo" }, { role: "assistant", content: "Saved reply" }];
    expect((await post("/api/conversation", { messages }, "demo-a")).status).toBe(200);
    expect(await (await get("/api/conversation", "demo-a")).json()).toEqual(messages);
    expect(await (await get("/api/conversation", "demo-b")).json()).toEqual([]);
    expect(await (await get("/api/conversation", "firebase-ok")).json()).toEqual([]);
    expect((await post("/api/conversation", { messages: [{ role: "system", content: "No" }] }, "demo-a")).status).toBe(400);
    expect((await get("/api/workspace", "invalid")).status).toBe(401);
  });
  it("creates one immutable draft, retries safely and rejects changed duplicate numbers without posting", async () => {
    const invoice = await createInvoice("member", invoiceInput);
    state.docs.set("companies/primary", {
      ...defaultCompany,
      name: "Changed later",
    });
    expect(
      await createInvoice("member", { ...invoiceInput, number: "inv-001" }),
    ).toEqual(invoice);
    await expect(
      createInvoice("member", { ...invoiceInput, customerName: "Different" }),
    ).rejects.toThrow("already in use");
    expect(
      [...state.docs.keys()].filter((k) => k.startsWith("invoices/")),
    ).toHaveLength(1);
    expect(
      [...state.docs.keys()].filter((k) => k.startsWith("invoiceLinks/")),
    ).toHaveLength(1);
    expect(
      [...state.docs.keys()].some((k) => /^(journals|expenses)\//.test(k)),
    ).toBe(false);
  });
  it("exposes a stable public PDF without login and separate attachment URL without leaking tax identifiers", async () => {
    const invoice = await createInvoice("member", invoiceInput);
    const links = await invoiceDownload("member", invoice.id);
    expect(await invoiceDownload("member", invoice.id)).toEqual(links);
    const publicPath = new URL(links.publicUrl).pathname;
    const view = await fetch(base + publicPath);
    expect(view.status).toBe(200);
    expect(view.headers.get("content-type")).toContain("application/pdf");
    expect(view.headers.get("content-disposition")).toContain("inline");
    expect(view.headers.get("cache-control")).toBe("no-store");
    expect(
      new TextDecoder().decode((await view.arrayBuffer()).slice(0, 5)),
    ).toBe("%PDF-");
    const download = await fetch(base + publicPath + "?download=1");
    expect(download.headers.get("content-disposition")).toContain(
      'attachment; filename="invoice-INV-001.pdf"',
    );
    const resolved = await resolvePublicInvoice(publicPath.split("/").at(-1)!);
    expect(JSON.stringify(resolved)).not.toContain("never-publish-this");
    expect(resolved).not.toHaveProperty("publicToken");
    expect(
      (await fetch(base + "/api/invoices/public/" + "a".repeat(43))).status,
    ).toBe(404);
  });
  it("blocks unauthenticated/disabled users and invalid invoices without creating public links", async () => {
    expect((await post("/api/invoices", invoiceInput, "invalid")).status).toBe(
      401,
    );
    state.docs.set("users/member", { active: false });
    expect((await post("/api/invoices", invoiceInput)).status).toBe(401);
    state.docs.set("users/member", { active: true });
    expect(
      (await post("/api/invoices", { ...invoiceInput, dueDate: "2026-10-01" }))
        .status,
    ).toBe(400);
    expect(
      [...state.docs.keys()].some((k) => k.startsWith("invoiceLinks/")),
    ).toBe(false);
  });
  it("uses the same registry in the agent and returns public download URLs", async () => {
    const response = await post("/api/chat", {
      messages: [{ role: "user", content: "Create this invoice" }],
    });
    expect(response.status).toBe(200);
    const result = JSON.parse((await response.json()).message);
    expect(result.download.publicUrl).toMatch(/\/api\/invoices\/public\//);
    expect(state.agent.tools.map((t: any) => t.name)).toEqual(
      sharedTools("member").map((t) => t.name),
    );
  });
  it("serves the PDF as a binary MCP resource", async () => {
    const creation = await rpc("tools/call", {
      name: "create_invoice",
      arguments: invoiceInput,
    });
    const body = await creation.json();
    expect(body.result?.isError).not.toBe(true);
    const created = JSON.parse(body.result.content[0].text);
    const response = await rpc("tools/call", {
      name: "download_invoice",
      arguments: { id: created.invoice.id },
    });
    const result = (await response.json()).result;
    const resource = result.content.find(
      (c: any) => c.type === "resource",
    ).resource;
    expect(resource.mimeType).toBe("application/pdf");
    expect(Buffer.from(resource.blob, "base64").subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  });
  it("requires invoices:write instead of reusing receipt consent, and blocks revoked MCP connections", async () => {
    const access = state.docs.get("oauthAccess/" + hash("mcp-token"));
    access.scope = "accounts:read receipts:write";
    const listed = (
      await (await rpc("tools/list", {})).json()
    ).result.tools.map((t: any) => t.name);
    expect(listed).toContain("download_invoice");
    expect(listed).not.toContain("create_invoice");
    const denied = await (
      await rpc("tools/call", {
        name: "create_invoice",
        arguments: invoiceInput,
      })
    ).json();
    expect(denied.result?.isError || denied.error).toBeTruthy();
    expect([...state.docs.keys()].some((k) => k.startsWith("invoices/"))).toBe(
      false,
    );
    state.docs.set("oauthConnections/connection", { revoked: true });
    expect((await rpc("tools/list", {})).status).toBe(401);
  });
});

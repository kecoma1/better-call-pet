import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ docs: new Map<string, any>() }));
vi.mock("firebase-admin/firestore", async () => {
  const { memoryFirestore } = await import("./helpers/firestore");
  const db = memoryFirestore(state.docs);
  return { getFirestore: () => db };
});
import { sharedTools } from "../src/tools";
import { defaultCompany, examples } from "../../src/domain";

const tools = () => sharedTools("member");
const execute = (name: string, input: unknown = {}) => tools().find((t) => t.name === name)!.execute(input);
const expenses = () => [...state.docs.entries()].filter(([key]) => key.startsWith("expenses/"));
const decision = (body: unknown = { answers: [{ name: "vat_recovery", type: "choice", choice: "deductible", confidence: 0.99 }] }) =>
  new Response(JSON.stringify(body));

beforeEach(() => {
  state.docs.clear();
  state.docs.set("companies/primary", defaultCompany);
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => decision());
});

describe("shared tool contracts and persistence", () => {
  it("exposes only the four supported tools, with no posting or payment capability", () => {
    expect(tools().map(({ name, readOnly }) => [name, readOnly])).toEqual([
      ["list_receipts", true], ["get_company", true], ["create_receipt", false], ["save_company", false],
    ]);
  });
  it("reads default and saved company configuration, then saves only validated fields", async () => {
    state.docs.clear();
    expect(await execute("get_company")).toMatchObject({ name: "Your LTD", vatRegistered: false });
    const saved = { ...defaultCompany, name: "Synthetic Event LTD" };
    expect(await execute("save_company", saved)).toEqual(saved);
    expect(await execute("get_company")).toEqual(saved);
    await expect(execute("save_company", { ...saved, vatRegistered: "yes" })).rejects.toThrow();
    expect(await execute("get_company")).toEqual(saved);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("lists only root expenses, newest first, bounded to 500", async () => {
    for (let index = 0; index < 501; index++)
      state.docs.set(`expenses/${index}`, { id: String(index), createdAt: String(index).padStart(4, "0") });
    state.docs.set("users/member/expenses/hidden", { id: "hidden" });
    const rows = await execute("list_receipts") as any[];
    expect(rows).toHaveLength(500);
    expect(rows[0].id).toBe("500");
    expect(rows.at(-1).id).toBe("1");
  });
  it("stores a review draft when the real Decisions response has no optional id", async () => {
    const receipt = await execute("create_receipt", examples[0]) as any;
    expect(receipt).toMatchObject({ status: "review", decision: { verdict: "deductible", reclaimPence: 1700, provider: "openai-decisions" } });
    expect(receipt.decision).not.toHaveProperty("decisionId");
    expect(expenses()).toHaveLength(1);
    expect(state.docs.get(`expenses/${receipt.id}`)).toEqual(receipt);
    expect([...state.docs.keys()].some((key) => key.startsWith("journals/"))).toBe(false);
  });
  it("preserves a supplied decision id, strips unknown input and never persists image data", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(decision({ id: "decision-1", answers: [{ name: "vat_recovery", type: "choice", choice: "deductible" }] }));
    const receipt = await execute("create_receipt", { ...examples[0], image: "data:image/png;base64,AAAA", status: "posted", createdBy: "other" }) as any;
    expect(receipt.status).toBe("review");
    expect(receipt.createdBy).toBe("member");
    expect(receipt.decision).toMatchObject({ decisionId: "decision-1", confidence: null });
    expect(receipt).not.toHaveProperty("image");
  });
  it.each([
    { netPence: 12.5 }, { vatPence: -1 }, { businessPercent: 101 },
    { date: "2026-02-30" }, { category: "invented" }, { vendor: " " },
  ])("rejects invalid create arguments before provider calls: %j", async (fields) => {
    await expect(execute("create_receipt", { ...examples[0], ...fields })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(expenses()).toHaveLength(0);
  });
  it("rejects duplicates without another quota charge or provider call", async () => {
    await execute("create_receipt", examples[0]);
    await expect(execute("create_receipt", { ...examples[0], vendor: ` ${examples[0].vendor.toUpperCase()} ` })).rejects.toThrow("already in your books");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(expenses()).toHaveLength(1);
    expect([...state.docs.entries()].find(([key]) => key.startsWith("aiUsage/"))![1].count).toBe(1);
  });
  it("allows concurrent distinct drafts but only one copy of a repeated receipt", async () => {
    const results = await Promise.allSettled([examples[0], examples[1], examples[0]].map((input) => execute("create_receipt", input)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(expenses()).toHaveLength(2);
    expect([...state.docs.entries()].find(([key]) => key.startsWith("aiUsage/"))![1].count).toBe(3);
  });
  it("rejects exhausted quota before Decisions or expense writes", async () => {
    state.docs.set(`aiUsage/member-${new Date().toISOString().slice(0, 10)}`, { count: 60 });
    await expect(execute("create_receipt", examples[0])).rejects.toThrow("Daily AI limit");
    expect(fetch).not.toHaveBeenCalled();
    expect(expenses()).toHaveLength(0);
  });
});

describe("Decisions boundary and conservative VAT gates", () => {
  it.each([
    [{ vatRegistered: false }, {}, "not_deductible", 0],
    [{}, { businessPercent: 0 }, "not_deductible", 0],
    [{}, { vatPence: 0 }, "not_deductible", 0],
    [{}, { validInvoice: false }, "review", 0],
    [{ vatScheme: "flat_rate" }, {}, "review", 0],
    [{}, { businessPercent: 33 }, "deductible", 561],
  ])("enforces company %j and receipt %j", async (company, fields, verdict, reclaimPence) => {
    state.docs.set("companies/primary", { ...defaultCompany, ...company });
    const receipt = await execute("create_receipt", { ...examples[0], ...fields }) as any;
    expect(receipt.decision).toMatchObject({ verdict, reclaimPence });
  });
  it("requires review for low confidence and sends the fixed server model", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(decision({ answers: [{ name: "vat_recovery", type: "choice", choice: "deductible", confidence: 0.5 }] }));
    const receipt = await execute("create_receipt", examples[0]) as any;
    expect(receipt.decision).toMatchObject({ verdict: "review", reclaimPence: 0 });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.model).toBe("gpt-6-luna");
  });
  it.each([
    {}, { answers: [] },
    { answers: [{ name: "vat_recovery", type: "refusal" }] },
    { answers: [{ name: "vat_recovery", type: "choice", choice: "unknown" }] },
    { answers: [{ name: "vat_recovery", type: "choice", choice: "deductible", confidence: 2 }] },
  ])("rejects unusable Decisions output without saving a guessed draft: %j", async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(decision(body));
    await expect(execute("create_receipt", examples[0])).rejects.toThrow("usable answer");
    expect(expenses()).toHaveLength(0);
  });
  it("saves no draft on provider failure or missing server configuration", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(execute("create_receipt", examples[0])).rejects.toThrow("No VAT decision was saved");
    delete process.env.OPENAI_API_KEY;
    await expect(execute("create_receipt", examples[0])).rejects.toThrow("not configured");
    expect(expenses()).toHaveLength(0);
  });
  it("rejects malformed provider JSON with a stable error before expense writes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("not json"));
    await expect(execute("create_receipt", examples[0])).rejects.toThrow("usable answer");
    expect(expenses()).toHaveLength(0);
  });
});

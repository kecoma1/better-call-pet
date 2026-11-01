import { describe, it, expect, vi, beforeEach } from "vitest";
const state = vi.hoisted(() => ({ docs: new Map<string, any>(), disabled: false, providerData: [] as unknown[] }));
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
    create: async (data: any) => {
      if (state.docs.has(key)) throw Error("Already exists");
      state.docs.set(key, data);
    },
    update: async (data: any) => {
      state.docs.set(key, { ...state.docs.get(key), ...data });
    },
  });
  return {
    getFirestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ref(name + "/" + id),
      }),
      runTransaction: async (fn: any) =>
        fn({
          get: async (r: any) => snap(r.key),
          set: (r: any, data: any) => state.docs.set(r.key, data),
          create: (r: any, data: any) => {
            if (state.docs.has(r.key)) throw Error("Already exists");
            state.docs.set(r.key, data);
          },
          update: (r: any, data: any) =>
            state.docs.set(r.key, { ...state.docs.get(r.key), ...data }),
        }),
    }),
  };
});
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    verifyIdToken: async (token: string) => {
      if (token !== "anonymous-token") throw Error("Invalid token");
      return { uid: "anonymous", firebase: { sign_in_provider: "anonymous" } };
    },
    getUser: async () => ({ disabled: state.disabled, providerData: state.providerData }),
  }),
}));
import { requireInternal, requireWorkspace, firebaseWorkspaceUser, firebaseUser, mcpUser, hash } from "../src/oauth";
import { createReceipt, postReceipt } from "../src/tools";
import { examples, defaultCompany } from "../../src/domain";
beforeEach(() => {
  state.docs.clear();
  state.disabled = false; state.providerData = [];
  process.env.INTERNAL_ADMIN_EMAIL = "internal@example.test";
  process.env.OPENAI_API_KEY = "test-only-key";
});
describe("internal access and expenses service", () => {
  it("derives the demo scope from verified claims and refuses internal access for the same anonymous token", async () => {
    const res: any = { locals: {}, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    const req: any = { headers: { authorization: "Bearer anonymous-token" }, body: { uid: "admin", demo: false } };
    await firebaseWorkspaceUser(req, res, next);
    expect(res.locals.actor).toEqual({ uid: "anonymous", demo: true });
    expect(next).toHaveBeenCalledOnce();
    expect(state.docs.has("users/anonymous")).toBe(false);
    next.mockClear();
    await firebaseUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("revalidates anonymous access before agent tools and during calls", async () => {
    const actor = { uid: "anonymous", demo: true as const };
    await expect(requireWorkspace(actor)).resolves.toBeUndefined();
    state.disabled = true;
    await expect(requireWorkspace(actor)).rejects.toThrow("disabled");
    state.disabled = false; state.providerData = [{ providerId: "google.com" }];
    await expect(requireWorkspace(actor)).rejects.toThrow("disabled");
  });
  it("enrolls only the verified configured initial admin", async () => {
    await expect(
      requireInternal("bad", "outsider@example.test", true),
    ).rejects.toThrow();
    await expect(
      requireInternal("bad", "internal@example.test", false),
    ).rejects.toThrow();
    await requireInternal("admin", "internal@example.test", true);
    expect(state.docs.get("users/admin").active).toBe(true);
    state.docs.set("users/admin", { active: false });
    await expect(
      requireInternal("admin", "internal@example.test", true),
    ).rejects.toThrow();
  });
  it("rejects bearer access immediately when membership is disabled", async () => {
    state.docs.set("oauthAccess/" + hash("bearer"), {
      uid: "admin",
      resource: "https://rent-o-accountant.web.app/mcp",
      expiresAt: Date.now() + 10000,
      connectionId: "conn",
      scope: "accounts:read",
    });
    state.docs.set("oauthConnections/conn", { revoked: false });
    state.docs.set("users/admin", { active: false });
    const end = vi.fn();
    const res: any = {
      locals: {},
      status: vi.fn().mockReturnThis(),
      json: end,
    };
    const next = vi.fn();
    await mcpUser(
      { headers: { authorization: "Bearer bearer" } } as any,
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("classifies once, rejects duplicates before another provider call and posts only one journal", async () => {
    state.docs.set("companies/primary", defaultCompany);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "decision-test",
            answers: [
              {
                name: "vat_recovery",
                type: "choice",
                choice: "deductible",
                confidence: 0.99,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const r = await createReceipt("admin", examples[0]);
    expect(r.status).toBe("review");
    await expect(createReceipt("admin", examples[0])).rejects.toThrow(
      "already in your books",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    await postReceipt("admin", r.id);
    await postReceipt("admin", r.id);
    expect(
      [...state.docs.keys()].filter((k) => k.startsWith("journals/")),
    ).toHaveLength(1);
    const lines = state.docs.get("journals/" + r.id).lines;
    expect(
      lines.reduce((sum: number, l: any) => sum + l.debit - l.credit, 0),
    ).toBe(0);
  });
  it("does not save an expense when Decisions fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 503 }),
    );
    await expect(createReceipt("admin", examples[0])).rejects.toThrow(
      "No VAT decision was saved",
    );
    expect(
      [...state.docs.keys()].filter((k) => k.startsWith("expenses/")),
    ).toHaveLength(0);
  });
});

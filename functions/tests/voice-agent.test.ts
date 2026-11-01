import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ authorize: vi.fn(), execute: vi.fn(), agent: null as any }));
vi.mock("../src/oauth", () => ({ requireInternal: state.authorize }));
vi.mock("../src/tools", () => ({ sharedTools: () => [{ name: "get_company", description: "Fixture company", schema: {}, execute: state.execute }] }));
vi.mock("@openai/agents", () => ({
  Agent: class { constructor(config: any) { state.agent = config; } },
  tool: (config: any) => config,
  run: async () => ({ finalOutput: await state.agent.tools[0].execute({}) }),
}));
import { runSaul } from "../src/agent";
beforeEach(() => { state.authorize.mockReset().mockResolvedValue(undefined); state.execute.mockReset().mockResolvedValue({ name: "Fixture LTD" }); });
it("uses gpt-6-luna and checks current membership before each shared tool", async () => {
  await expect(runSaul("member", [{ role: "user", content: "My company?" }])).resolves.toContain("Fixture LTD");
  expect(state.agent.model).toBe("gpt-6-luna");
  expect(state.authorize).toHaveBeenCalledWith("member");
  state.execute.mockClear(); state.authorize.mockRejectedValue(Error("Workspace access disabled."));
  await expect(runSaul("member", [{ role: "user", content: "My company?" }])).rejects.toThrow("could not finish");
  expect(state.execute).not.toHaveBeenCalled();
});
it("does not mutate after cancellation during the authorization check", async () => {
  const abort = new AbortController();
  state.authorize.mockImplementation(async () => abort.abort());
  await expect(runSaul("member", [{ role: "user", content: "My company?" }], abort.signal)).rejects.toThrow();
  expect(state.execute).not.toHaveBeenCalled();
});
it("publishes only the public card from a successful shared tool", async () => {
  state.execute.mockResolvedValue({ name: "Fixture LTD", vatRegistered: true, yearEnd: "2027-03-31", utr: "private-fixture" });
  const onTool = vi.fn();
  await runSaul("member", [{ role: "user", content: "My company?" }], undefined, onTool);
  expect(onTool).toHaveBeenCalledWith({ name: "get_company", company: { name: "Fixture LTD", vatRegistered: true, yearEnd: "2027-03-31" } });
  expect(JSON.stringify(onTool.mock.calls)).not.toContain("private-fixture");
  onTool.mockClear(); state.execute.mockRejectedValue(Error("Unavailable"));
  await expect(runSaul("member", [{ role: "user", content: "My company?" }], undefined, onTool)).rejects.toThrow();
  expect(onTool).not.toHaveBeenCalled();
});

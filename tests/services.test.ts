import { describe, it, expect, vi } from "vitest";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
import {
  fetchWorkspace,
  createReceipt,
  sendChat,
  fetchConnections,
} from "../src/services/workspace";
import { examples, defaultCompany } from "../src/domain";
describe("workspace response boundaries", () => {
  it("rejects an incomplete workspace with a readable error", async () => {
    vi.mocked(api).mockResolvedValue({ company: defaultCompany });
    await expect(fetchWorkspace()).rejects.toThrow("incomplete");
  });
  it("passes provider failures back to the expense form", async () => {
    vi.mocked(api).mockRejectedValue(Error("Decisions unavailable"));
    await expect(createReceipt(examples[0])).rejects.toThrow(
      "Decisions unavailable",
    );
  });
  it("requires a saved expense identity and decision", async () => {
    vi.mocked(api).mockResolvedValue({ vendor: "Test" });
    await expect(createReceipt(examples[0])).rejects.toThrow(
      "No receipt was returned",
    );
  });
  it("rejects a missing assistant reply", async () => {
    vi.mocked(api).mockResolvedValue({});
    await expect(
      sendChat([{ role: "user", content: "Hello" }]),
    ).rejects.toThrow("could not finish");
  });
  it("rejects malformed connection responses", async () => {
    vi.mocked(api).mockResolvedValue({ connections: [] });
    await expect(fetchConnections()).rejects.toThrow("Could not load");
  });
});

import { describe, it, expect, vi } from "vitest";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
import {
  fetchWorkspace,
  createReceipt,
  sendChat,
  fetchConnections,
  extractReceipt,
} from "../src/services/workspace";
import { examples, defaultCompany } from "../src/domain";
describe("workspace response boundaries", () => {
  const extracted = {
    vendor: "Fictional Stationery",
    date: "2026-11-01",
    reference: "TEST-001",
    netPence: 1200,
    vatPence: 240,
    currency: "GBP",
  };
  it("sends the image to the extraction function and validates its fields", async () => {
    vi.mocked(api).mockResolvedValue(extracted);
    await expect(extractReceipt("data:image/png;base64,test")).resolves.toEqual(
      extracted,
    );
    expect(api).toHaveBeenCalledWith("/extract", {
      image: "data:image/png;base64,test",
    });
  });
  it("keeps missing invoice evidence nullable for manual review", async () => {
    const missing = Object.fromEntries(
      Object.keys(extracted).map((key) => [key, null]),
    );
    vi.mocked(api).mockResolvedValue(missing);
    await expect(extractReceipt("image")).resolves.toEqual(missing);
  });
  it.each([
    {},
    { ...extracted, netPence: 12.5 },
    { ...extracted, vatPence: -1 },
    { ...extracted, date: "2026-02-30" },
  ])(
    "rejects malformed extraction data before it reaches the form",
    async (data) => {
      vi.mocked(api).mockResolvedValue(data);
      await expect(extractReceipt("image")).rejects.toThrow(
        "incomplete receipt data",
      );
    },
  );
  it("preserves extraction failures for a visible retry", async () => {
    vi.mocked(api).mockRejectedValue(Error("Extraction unavailable"));
    await expect(extractReceipt("image")).rejects.toThrow(
      "Extraction unavailable",
    );
  });
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

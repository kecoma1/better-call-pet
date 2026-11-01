import { describe, it, expect, vi } from "vitest";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
import {
  createInvoice,
  fetchInvoices,
  getInvoiceDownload,
} from "../src/services/invoices";
import { buildInvoice } from "../src/lib/invoices";
import { defaultCompany } from "../src/domain";
import { invoiceInput } from "./fixtures/invoice";
const invoice = buildInvoice(
  invoiceInput,
  { ...defaultCompany, vatNumber: "GB000000000" },
  "a".repeat(32),
  "member",
);
const publicUrl =
  "https://rent-o-accountant.web.app/api/invoices/public/" + "a".repeat(43);
describe("invoice services", () => {
  it("validates invoice lists and saved invoices instead of passing malformed responses to rendering", async () => {
    const controller = new AbortController();
    vi.mocked(api).mockResolvedValue([invoice]);
    expect(await fetchInvoices(controller.signal)).toEqual([invoice]);
    expect(api).toHaveBeenCalledWith("/invoices", undefined, controller.signal);
    vi.mocked(api).mockResolvedValue([{ ...invoice, totalPence: "29628" }]);
    await expect(fetchInvoices()).rejects.toThrow("incomplete");
    vi.mocked(api).mockResolvedValue(invoice);
    expect(await createInvoice(invoiceInput)).toEqual(invoice);
    vi.mocked(api).mockResolvedValue({ id: "missing-fields" });
    await expect(createInvoice(invoiceInput)).rejects.toThrow(
      "No valid invoice",
    );
    vi.mocked(api).mockRejectedValue(Error("Sign in required"));
    await expect(fetchInvoices()).rejects.toThrow("Sign in required");
  });
  it("validates same-origin public and attachment URLs and forwards server failures", async () => {
    const links = {
      url: publicUrl + "?download=1",
      publicUrl,
      filename: "invoice-INV-001.pdf",
    };
    vi.mocked(api).mockResolvedValue(links);
    expect(await getInvoiceDownload(invoice, true)).toEqual(links);
    for (const patch of [
      { url: "javascript:alert(1)" },
      { url: "https://example.test/file.pdf" },
      { publicUrl: "https://example.test/file.pdf" },
      { filename: "other.pdf" },
      { url: publicUrl + "?download=1&extra=1" },
    ]) {
      vi.mocked(api).mockResolvedValue({ ...links, ...patch });
      await expect(getInvoiceDownload(invoice, true)).rejects.toThrow(
        "No valid download",
      );
    }
    vi.mocked(api).mockRejectedValue(Error("Invoice not found"));
    await expect(getInvoiceDownload(invoice, true)).rejects.toThrow(
      "Invoice not found",
    );
  });
  it("creates only a local demo PDF and respects cancellation before creating blob URLs", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:demo");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL }));
    const result = await getInvoiceDownload(invoice, false);
    expect(result).toEqual({
      url: "blob:demo",
      publicUrl: "",
      filename: "invoice-INV-001.pdf",
    });
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe(
      "application/pdf",
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      getInvoiceDownload(invoice, false, controller.signal),
    ).rejects.toThrow();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});

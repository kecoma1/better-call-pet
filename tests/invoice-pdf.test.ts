import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateInvoicePdf } from "../src/lib/invoice-pdf";
import { buildInvoice } from "../src/lib/invoices";
import { defaultCompany } from "../src/domain";
import { invoiceInput } from "./fixtures/invoice";
const invoice = buildInvoice(
  invoiceInput,
  { ...defaultCompany, vatNumber: "GB000000000" },
  "a".repeat(32),
  "member",
);
describe("downloadable invoice PDF", () => {
  it("produces a readable A4 draft with the saved issuer and invoice reference", async () => {
    const bytes = await generateInvoicePdf(invoice);
    const doc = await PDFDocument.load(new Uint8Array(bytes));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Draft invoice INV-001");
    expect(doc.getAuthor()).toBe(defaultCompany.name);
    expect(doc.getPages()[0].getWidth()).toBeCloseTo(595.28);
  });
  it("paginates 50 long descriptions and notes without dropping items", async () => {
    const doc = await PDFDocument.load(
      new Uint8Array(
        await generateInvoicePdf(
          {
            ...invoice,
            lines: Array.from({ length: 50 }, (_, i) => ({
              ...invoice.lines[0],
              description: `Item ${i + 1}: ` + "Long description ".repeat(16),
            })),
            notes: "Notes ".repeat(300),
          },
          true,
        ),
      ),
    );
    expect(doc.getPageCount()).toBeGreaterThan(3);
    expect(doc.getPages().every((p) => p.getHeight() === 841.89)).toBe(true);
  });
});

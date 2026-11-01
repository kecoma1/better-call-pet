import { describe, it, expect } from "vitest";
import {
  buildInvoice,
  invoiceTotals,
  invoiceInputSchema,
  invoiceNumberKey,
  poundsToPence,
  isInvoice,
  invoiceFilename,
} from "../src/lib/invoices";
import { defaultCompany } from "../src/domain";
import { invoiceInput } from "./fixtures/invoice";
const company = { ...defaultCompany, vatNumber: "GB000000000" };
describe("integer-pence invoice drafts", () => {
  it("calculates explicit line VAT and snapshots only public seller details", () => {
    const invoice = buildInvoice(
      invoiceInput,
      { ...company, utr: "private-tax-id" },
      "a".repeat(32),
      "test-member",
    );
    expect(invoiceTotals(invoiceInput)).toEqual({
      netPence: 24690,
      vatPence: 4938,
      totalPence: 29628,
    });
    expect(invoice.status).toBe("draft");
    expect(invoice.seller).not.toHaveProperty("utr");
    expect(isInvoice(invoice)).toBe(true);
    expect(isInvoice({ ...invoice, totalPence: 10 })).toBe(false);
    expect(isInvoice({ ...invoice, status: "posted" })).toBe(false);
    expect(invoiceNumberKey(" inv-001 ")).toBe("INV-001");
    expect(invoiceFilename({ number: "INV/001" })).toBe("invoice-INV-001.pdf");
  });
  it.each(["0", "0.01", "12.3", "123.45"])(
    "parses %s without floating-point money",
    (value) => {
      expect(poundsToPence(value)).toBe(
        (
          { "0": 0, "0.01": 1, "12.3": 1230, "123.45": 12345 } as Record<
            string,
            number
          >
        )[value],
      );
    },
  );
  it.each(["", "1.001", "-1", "1e3", "Infinity", "NaN", "1000000.01", "1,000"])(
    "rejects invalid amount %s",
    (value) => expect(poundsToPence(value)).toBeNull(),
  );
  it("rejects impossible dates, fractional pence, empty lines, overflow and unsupported PDF text", () => {
    for (const patch of [
      { issueDate: "2026-02-30" },
      { dueDate: "2026-10-31" },
      { lines: [] },
      { lines: [{ ...invoiceInput.lines[0], unitPence: 10.5 }] },
      {
        lines: [
          { ...invoiceInput.lines[0], quantity: 10000, unitPence: 100000000 },
        ],
      },
      { customerName: "Client 🐾" },
      { customerName: "\u0000" },
    ])
      expect(
        invoiceInputSchema.safeParse({ ...invoiceInput, ...patch }).success,
      ).toBe(false);
    expect(
      invoiceInputSchema.safeParse({
        ...invoiceInput,
        customerName: "José Muñoz",
      }).success,
    ).toBe(true);
  });
  it("does not charge VAT without company registration and VAT number", () => {
    expect(() =>
      buildInvoice(
        invoiceInput,
        { ...company, vatRegistered: false },
        "a".repeat(32),
        "test",
      ),
    ).toThrow("not VAT registered");
    expect(() =>
      buildInvoice(invoiceInput, defaultCompany, "a".repeat(32), "test"),
    ).toThrow("VAT number");
    expect(
      buildInvoice(
        { ...invoiceInput, lines: [{ ...invoiceInput.lines[0], vatPence: 0 }] },
        { ...defaultCompany, vatRegistered: false },
        "a".repeat(32),
        "test",
      ).vatPence,
    ).toBe(0);
  });
});

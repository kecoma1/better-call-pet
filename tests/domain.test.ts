import { describe, it, expect } from "vitest";
import {
  demoDecision,
  defaultCompany,
  examples,
  journal,
  duplicateKey,
  type Receipt,
} from "../src/domain";
describe("expense VAT and balanced journals", () => {
  it("uses only the business proportion and routes personal gross to the director loan", () => {
    const r = { ...examples[0], businessPercent: 50 };
    const decision = demoDecision(r, defaultCompany);
    expect(decision.reclaimPence).toBe(850);
    const lines = journal({
      ...r,
      id: "test",
      status: "posted",
      decision,
      createdAt: "",
    } as Receipt);
    expect(lines.find((l) => l.account.startsWith("2100"))?.debit).toBe(5100);
    expect(lines.reduce((n, l) => n + l.debit - l.credit, 0)).toBe(0);
  });
  it("blocks UK client entertainment and treats the VAT as a cost", () => {
    const r = examples[1];
    const d = demoDecision(r, defaultCompany);
    expect(d.verdict).toBe("not_deductible");
    expect(d.reclaimPence).toBe(0);
    const lines = journal({
      ...r,
      id: "test",
      status: "posted",
      decision: d,
      createdAt: "",
    });
    expect(lines[0].debit).toBe(14400);
    expect(lines.at(-1)?.credit).toBe(14400);
  });
  it("never recovers VAT without registration or business use", () => {
    expect(
      demoDecision(examples[0], { ...defaultCompany, vatRegistered: false })
        .reclaimPence,
    ).toBe(0);
    expect(
      demoDecision({ ...examples[0], businessPercent: 0 }, defaultCompany)
        .verdict,
    ).toBe("not_deductible");
  });
  it("requires review for missing invoice evidence and Flat Rate Scheme", () => {
    expect(
      demoDecision({ ...examples[0], validInvoice: false }, defaultCompany)
        .verdict,
    ).toBe("review");
    expect(
      demoDecision(examples[0], { ...defaultCompany, vatScheme: "flat_rate" })
        .verdict,
    ).toBe("review");
  });
  it("normalises supplier/reference whitespace for duplicate detection", () => {
    expect(duplicateKey(examples[0])).toBe(
      duplicateKey({
        ...examples[0],
        vendor: " PAPER & CO. ",
        reference: " pc-1042 ",
      }),
    );
  });
  it("balances integer-pence rounding at every business percentage", () => {
    for (let n = 0; n <= 100; n++) {
      const r = {
        ...examples[0],
        netPence: 999,
        vatPence: 200,
        businessPercent: n,
      };
      const lines = journal({
        ...r,
        id: "x",
        status: "posted",
        decision: demoDecision(r, defaultCompany),
        createdAt: "",
      });
      expect(lines.reduce((n, l) => n + l.debit - l.credit, 0)).toBe(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { demoConversation } from "../src/lib/demo-chat";
import { demoReceipts } from "../src/domain";
describe("explicit demo conversations", () => {
  it.each([
    ["VAT recovery", "VAT"],
    ["Bookkeeping help", "Bookkeeping"],
    ["Annual accounts", "Annual accounts"],
    ["Corporate tax", "Corporate Tax"],
    ["Receipts list", "Receipts"],
  ])("routes %s to %s with demo provenance", (text, topic) => {
    const result = demoConversation(null, "demo", text, demoReceipts);
    expect(result.topic).toBe(topic);
    expect(result.provider).toBe("demo-rules");
    expect(result.messages[1].content).toContain("demo workspace");
    expect(result.messages[1].tools?.[0].receipts).toHaveLength(3);
  });
  it("preserves history and title while allowing topic changes and empty receipts", () => {
    const first = demoConversation(null, "demo", "Hi", []);
    expect(first.topic).toBe("Bookkeeping");
    expect(first.messages[1].content).toContain("£0.00");
    const next = demoConversation(first, "demo", "VAT", []);
    expect(next.topic).toBe("VAT");
    expect(next.title).toBe("Hi");
    expect(next.messages).toHaveLength(4);
  });
});

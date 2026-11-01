import {
  money,
  type Conversation,
  type ConversationTopic,
  type Receipt,
} from "../domain";

// Illustrative browser-only routing; never used as a fallback for a live request.
export function demoConversation(
  previous: Conversation | null,
  id: string,
  message: string,
  items: Receipt[],
): Conversation {
  let topic: ConversationTopic = previous?.topic ?? "Bookkeeping";
  if (/vat|iva/i.test(message)) topic = "VAT";
  else if (/annual|year.?end|accounts|cuentas anuales/i.test(message))
    topic = "Annual accounts";
  else if (/corporat|ct600|sociedades/i.test(message)) topic = "Corporate Tax";
  else if (/receipt|invoice|factura|recibo/i.test(message)) topic = "Receipts";
  else if (/book|journal|ledger|contabili/i.test(message))
    topic = "Bookkeeping";
  const vat = items
    .filter((r) => r.status === "posted")
    .reduce((sum, r) => sum + r.decision.reclaimPence, 0);
  return {
    id,
    title: previous?.title ?? message.slice(0, 80),
    topic,
    provider: "demo-rules",
    preview: `This is the demo workspace. You have ${items.length} receipts and ${money(vat)} of recoverable VAT posted. ${items.filter((r) => r.status === "review").length} receipts are waiting for review. Sign in to use the live agent.`,
    updatedAt: new Date().toISOString(),
    messages: [
      ...(previous?.messages ?? []),
      { role: "user", content: message },
      {
        role: "assistant",
        content: `This is the demo workspace. You have ${items.length} receipts and ${money(vat)} of recoverable VAT posted. ${items.filter((r) => r.status === "review").length} receipts are waiting for review. Sign in to use the live agent.`,
        tools: [
          {
            name: "list_receipts",
            receipts: items.map(
              ({ id, vendor, netPence, vatPence, status }) => ({
                id,
                vendor,
                netPence,
                vatPence,
                status,
              }),
            ),
          },
        ],
      },
    ],
  };
}

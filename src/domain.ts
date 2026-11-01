export type Verdict = "deductible" | "not_deductible" | "review";
export const conversationTopics = [
  "VAT",
  "Bookkeeping",
  "Annual accounts",
  "Corporate Tax",
  "Receipts",
] as const;
export type ConversationTopic = (typeof conversationTopics)[number];
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tools?: ChatToolResult[];
  activity?: ChatEvent[];
}
export interface ChatToolResult {
  name: "list_receipts" | "get_company" | "create_receipt" | "save_company";
  receipts?: Pick<
    Receipt,
    "id" | "vendor" | "netPence" | "vatPence" | "status"
  >[];
  receiptCount?: number;
  company?: Pick<Company, "name" | "vatRegistered" | "yearEnd">;
}
export const chatEventKinds = [
  "classifying",
  "classified",
  "tool_started",
  "tool_completed",
  "tool_failed",
  "responding",
  "completed",
  "failed",
] as const;
export interface ChatEvent {
  sequence: number;
  kind: (typeof chatEventKinds)[number];
  at: string;
  tool?: ChatToolResult["name"];
  topic?: ConversationTopic;
}
export interface ChatRun {
  requestId: string;
  conversationId: string;
  createdBy: string;
  status: "running" | "completed" | "failed";
  updatedAt: string;
  content: string;
  tools: ChatToolResult[];
  events: ChatEvent[];
}
export interface ConversationSummary {
  id: string;
  title: string;
  topic: ConversationTopic;
  preview: string;
  updatedAt: string;
  provider: "openai-decisions" | "demo-rules";
}
export interface Conversation extends ConversationSummary {
  messages: ChatMessage[];
}
export type Category =
  | "Software"
  | "Office supplies"
  | "Client entertainment"
  | "Travel"
  | "Equipment"
  | "Other";
export interface Company {
  name: string;
  number: string;
  utr: string;
  yearEnd: string;
  tradingStart: string;
  vatRegistered: boolean;
  vatNumber: string;
  vatScheme: "standard" | "flat_rate";
}
export interface ReceiptInput {
  vendor: string;
  date: string;
  reference: string;
  netPence: number;
  vatPence: number;
  category: Category;
  businessPercent: number;
  validInvoice: boolean;
  notes: string;
  image?: string;
}
export interface Decision {
  verdict: Verdict;
  reason: string;
  source: string;
  confidence: number | null;
  provider: "demo-rules" | "openai-decisions";
  reclaimPence: number;
  decisionId?: string;
}
export interface Receipt extends ReceiptInput {
  id: string;
  decision: Decision;
  status: "review" | "posted";
  createdAt: string;
}
export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}
export const defaultCompany: Company = {
  name: "Acme Studio Ltd",
  number: "",
  utr: "",
  yearEnd: "2027-03-31",
  tradingStart: "2026-04-01",
  vatRegistered: true,
  vatNumber: "",
  vatScheme: "standard",
};
export const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  );
export const vatSource =
  "https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses";
export function demoDecision(r: ReceiptInput, c: Company): Decision {
  let verdict: Verdict = "deductible",
    reason =
      "A valid VAT invoice for a business purchase. Only the stated business proportion is recoverable.";
  if (!c.vatRegistered) {
    verdict = "not_deductible";
    reason =
      "The company is not VAT registered. Keep this invoice for a possible pre-registration claim after registration.";
  } else if (!r.validInvoice) {
    verdict = "review";
    reason =
      "A valid VAT invoice is needed. Request the invoice before claiming input VAT.";
  } else if (c.vatScheme === "flat_rate") {
    verdict = "review";
    reason =
      "Flat Rate Scheme purchase VAT is normally blocked; some capital assets have exceptions. Review this separately.";
  } else if (r.businessPercent === 0) {
    verdict = "not_deductible";
    reason =
      "This is a personal purchase. VAT cannot be recovered for personal use.";
  } else if (r.category === "Client entertainment") {
    verdict = "not_deductible";
    reason =
      "VAT on hospitality for UK business contacts is normally blocked. Review any overseas-customer exception separately.";
  } else if (r.vatPence === 0) {
    verdict = "not_deductible";
    reason =
      "No VAT is recorded on this receipt. There is no input VAT to reclaim.";
  } else if (["Travel", "Equipment", "Other"].includes(r.category)) {
    verdict = "review";
    reason =
      "This category can involve special rules. Confirm the VAT treatment and business use before posting.";
  }
  return {
    verdict,
    reason,
    source: vatSource,
    confidence: null,
    provider: "demo-rules",
    reclaimPence:
      verdict === "deductible"
        ? Math.round((r.vatPence * r.businessPercent) / 100)
        : 0,
  };
}
export function journal(r: Receipt): JournalLine[] {
  const gross = r.netPence + r.vatPence;
  const businessGross = Math.round((gross * r.businessPercent) / 100);
  const recovered = r.decision.reclaimPence;
  return [
    {
      account:
        r.category === "Equipment"
          ? "1500 · Equipment"
          : "5000 · " + r.category,
      debit: businessGross - recovered,
      credit: 0,
    },
    ...(gross > businessGross
      ? [
          {
            account: "2100 · Director loan",
            debit: gross - businessGross,
            credit: 0,
          },
        ]
      : []),
    ...(recovered
      ? [{ account: "2201 · VAT recoverable", debit: recovered, credit: 0 }]
      : []),
    { account: "2101 · Trade creditors", debit: 0, credit: gross },
  ];
}
export function duplicateKey(r: ReceiptInput) {
  return [
    r.vendor.trim().toLowerCase(),
    r.date,
    r.reference.trim().toLowerCase(),
    r.netPence,
    r.vatPence,
  ].join("|");
}
export const examples: ReceiptInput[] = [
  {
    vendor: "Paper & Co.",
    date: "2026-11-01",
    reference: "PC-1042",
    netPence: 8500,
    vatPence: 1700,
    category: "Office supplies",
    businessPercent: 100,
    validInvoice: true,
    notes: "Stationery and notebooks for the studio.",
  },
  {
    vendor: "The Ivy",
    date: "2026-11-01",
    reference: "IV-2081",
    netPence: 12000,
    vatPence: 2400,
    category: "Client entertainment",
    businessPercent: 100,
    validInvoice: true,
    notes: "Dinner with a UK client to discuss the new project.",
  },
  {
    vendor: "Figma UK",
    date: "2026-10-28",
    reference: "FG-9001",
    netPence: 1500,
    vatPence: 300,
    category: "Software",
    businessPercent: 100,
    validInvoice: true,
    notes: "Monthly design subscription, UK VAT charged on invoice.",
  },
];
export const demoReceipts: Receipt[] = examples.map((r, i) => ({
  ...r,
  id: "sample-" + i,
  status: i === 2 ? "posted" : "review",
  decision: demoDecision(r, defaultCompany),
  createdAt: r.date + "T10:00:00Z",
}));

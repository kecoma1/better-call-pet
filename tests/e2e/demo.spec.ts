import { test, expect, type Page } from "@playwright/test";
import { defaultCompany, demoReceipts, examples, type Invoice, type Receipt } from "../../src/domain";
import { buildInvoice } from "../../src/lib/invoices";
import { invoiceInput } from "../fixtures/invoice";

async function demoFixture(page: Page, failedChat = false) {
  // Firebase and HTTP are fixture boundaries. The real workspace hook, forms,
  // services and persistence round trips run without a Google identity.
  await page.route("**/src/firebase.ts", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `
      const user = { uid: "fixture-anonymous", isAnonymous: true, displayName: null, getIdToken: async () => "fixture-anonymous-token" };
      export const auth = {};
      export const currentWorkspaceUser = () => user;
      export const signIn = async () => { throw Error("Google sign-in must not be needed"); };
      export function observeWorkspaceSession(receive) { const timer = setTimeout(() => receive(user), 0); return () => clearTimeout(timer); }
    `,
  }));
  let company = { ...defaultCompany };
  let receipts: Receipt[] = demoReceipts.map((r) => ({ ...r }));
  const invoices: Invoice[] = [];
  let messages: unknown[] = [];
  const requests: string[] = [];
  await page.route("**/api/**", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer fixture-anonymous-token");
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const body = route.request().method() === "POST" ? route.request().postDataJSON() : undefined;
    let json: unknown;
    if (path === "/api/workspace") json = { company, receipts };
    else if (path === "/api/company") json = company = body;
    else if (path === "/api/receipts") {
      const receipt: Receipt = { ...body, image: undefined, id: "b".repeat(32), createdAt: new Date().toISOString(), status: "review",
        decision: { verdict: "deductible", provider: "openai-decisions", decisionId: "fixture-decision", reclaimPence: body.vatPence, confidence: 0.99, reason: "Fixture provider result", source: "https://www.gov.uk/charge-reclaim-record-vat/reclaim-vat-business-expenses" } };
      receipts.unshift(receipt); json = receipt;
    } else if (path === "/api/receipts/post") {
      receipts = receipts.map((r) => r.id === body.id ? { ...r, status: "posted" } : r);
      json = receipts.find((r) => r.id === body.id);
    } else if (path === "/api/extract") json = { vendor: "Demo supplier", date: examples[0].date, reference: "DEMO-NEW", netPence: 8500, vatPence: 1700, currency: "GBP" };
    else if (path === "/api/invoices") {
      if (body) invoices.unshift({ ...buildInvoice(body, company, "a".repeat(32), "fixture-anonymous"), demo: true });
      json = body ? invoices[0] : invoices;
    } else if (path === "/api/invoices/download") {
      const publicUrl = "https://rent-o-accountant.web.app/api/invoices/public/" + "a".repeat(43);
      json = { publicUrl, url: publicUrl + "?download=1", filename: "invoice-INV-001.pdf" };
    } else if (path === "/api/conversation") {
      if (body) messages = body.messages;
      json = body ? { ok: true } : messages;
    } else if (path === "/api/chat") {
      if (failedChat) { await route.fulfill({ status: 503, json: { error: "AI temporarily unavailable" } }); return; }
      json = { message: "Your demo changes are saved in your workspace." };
    } else throw Error("Unexpected API request: " + path);
    await route.fulfill({ json });
  });
  return requests;
}

test("anonymous demo extracts, posts, saves company and restores chat and receipts after reload", async ({ page }) => {
  const requests = await demoFixture(page);
  await page.goto("/");
  await expect(page.getByText("Saved automatically")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add receipt", exact: true }).click();
  await page.getByLabel("Drop the paperwork. Keep the progress.").setInputFiles({ name: "fictional.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  await expect(page.getByLabel("Supplier")).toHaveValue("Demo supplier");
  await page.getByRole("button", { name: "Get VAT decision" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("row", { name: "View expense details for Demo supplier" }).click();
  await page.getByRole("button", { name: "Approve & post to books" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: page.viewportSize()!.width < 768 ? "Open settings" : "Settings & connections" }).click();
  await page.getByLabel("Legal company name").fill("Persistent Demo Ltd");
  await page.getByRole("button", { name: "Save company details" }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByRole("button", { name: "Call Saul" })).toBeEnabled();
  await page.getByLabel("Message Saul").fill("What did I save?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Your demo changes are saved in your workspace.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistent Demo Ltd").first()).toHaveCount(1);
  await page.getByRole("row", { name: "View expense details for Demo supplier" }).click();
  await expect(page.getByRole("button", { name: "Already in your books" })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByText("What did I save?", { exact: true })).toBeVisible();
  await expect(page.getByText("Your demo changes are saved in your workspace.")).toBeVisible();
  expect(requests).toContain("/api/extract");
  expect(requests).toContain("/api/receipts/post");
  expect(requests).toContain("/api/chat");
});

test("anonymous demo creates a persistent invoice and retrieves its public PDF", async ({ page }) => {
  await demoFixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await page.getByRole("button", { name: "Create invoice", exact: true }).click();
  await page.getByLabel("Invoice number").fill(invoiceInput.number);
  await page.getByLabel("Issue date").fill(invoiceInput.issueDate);
  await page.getByLabel("Due date").fill(invoiceInput.dueDate);
  await page.getByLabel("Seller address").fill(invoiceInput.sellerAddress);
  await page.getByLabel("Customer name").fill(invoiceInput.customerName);
  await page.getByLabel("Customer address").fill(invoiceInput.customerAddress);
  await page.getByLabel("Description 1").fill("Demo services");
  await page.getByLabel("Unit price (£) 1").fill("100");
  await page.getByRole("button", { name: "Create draft invoice" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await page.getByRole("button", { name: "Get PDF link for INV-001" }).click();
  await expect(page.getByRole("link", { name: "Download INV-001 PDF" })).toHaveAttribute("href", /\?download=1$/);
  await expect(page.getByRole("link", { name: "View public invoice" })).toBeVisible();
});

test("anonymous AI failure keeps the message and never substitutes a sample response", async ({ page }) => {
  await demoFixture(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await page.getByLabel("Message Saul").fill("Check my books");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toHaveText("AI temporarily unavailable");
  await expect(page.getByText(/This is the demo workspace/)).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByText("Check my books", { exact: true })).toBeVisible();
});

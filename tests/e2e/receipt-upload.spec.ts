import { test, expect } from "@playwright/test";

const image = {
  name: "fictional-receipt.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
const extracted = {
  vendor: "Fictional Stationery",
  date: "2026-11-01",
  reference: "TEST-001",
  netPence: 1200,
  vatPence: 240,
  currency: "GBP",
};

test("image-first demo, explicit send, manual review and fresh reopen", async ({
  page,
}) => {
  await page.goto("/");
  if (!(await page.getByRole("button", { name: "Open workspace" }).isVisible()))
    await page.getByRole("button", { name: "Show conversations" }).click();
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.getByRole("button", { name: "Add receipt", exact: true }).click();
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send receipt" }),
  ).toBeDisabled();
  await page
    .getByLabel("Drop the paperwork. Keep the progress.")
    .setInputFiles(image);
  await expect(
    page.getByRole("button", { name: "Send receipt" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
  await page.getByRole("button", { name: "Send receipt" }).click();
  await expect(
    page.getByRole("img", { name: "Saul is thinking" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "automatic extraction is available after sign-in",
  );
  await page.getByRole("button", { name: "Enter receipt details" }).click();
  await expect(page.getByLabel("Supplier")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Add receipt", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send receipt" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
});

test("live extraction waits for send, shows Saul, reviews the function response and saves explicitly", async ({
  page,
}, testInfo) => {
  // A component harness keeps synthetic authentication away from the real Firebase SDK.
  await page.route("**/src/firebase.ts", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export const auth = { currentUser: { getIdToken: async () => "synthetic-test-token" } };',
    }),
  );
  let finishExtraction!: () => void;
  const holdExtraction = new Promise<void>((resolve) => {
    finishExtraction = resolve;
  });
  let extractions = 0;
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/extract", async (route) => {
    extractions++;
    expect(route.request().postDataJSON().image).toMatch(
      /^data:image\/png;base64,/,
    );
    await holdExtraction;
    await route.fulfill({ json: extracted });
  });
  await page.route("**/api/receipts", async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({
      json: { id: "synthetic-receipt", decision: { verdict: "review" } },
    });
  });
  await page.goto("/tests/e2e/fixtures/receipt-flow.html");
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: testInfo.outputPath("receipt-upload.png") });
  await page
    .getByLabel("Drop the paperwork. Keep the progress.")
    .setInputFiles(image);
  await expect(
    page.getByRole("button", { name: "Send receipt" }),
  ).toBeEnabled();
  expect(extractions).toBe(0);
  await page.getByRole("button", { name: "Send receipt" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saul is reading your receipt",
  );
  await expect(
    page.getByRole("img", { name: "Saul is thinking" }),
  ).toBeVisible();
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
  expect(saved).toBeUndefined();
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: testInfo.outputPath("receipt-reading.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  finishExtraction();
  await expect(page.getByLabel("Supplier")).toHaveValue(extracted.vendor);
  await expect(page.getByLabel("Net amount (£)")).toHaveValue("12");
  await expect(page.getByLabel("VAT amount (£)")).toHaveValue("2.4");
  expect(saved).toBeUndefined();
  await page.getByLabel("Supplier").fill("Corrected supplier");
  await page.getByRole("button", { name: "Get VAT decision" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(saved).toMatchObject({
    vendor: "Corrected supplier",
    netPence: 1200,
    vatPence: 240,
  });
});

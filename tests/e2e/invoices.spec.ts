import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

test("create, persist and download a demo invoice without posting it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(
    page.getByText("No invoices yet. Create your first draft invoice."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create invoice" });
  await expect(
    dialog.getByRole("button", { name: "Create draft invoice" }),
  ).toBeDisabled();
  for (const [label, value] of Object.entries({
    "Invoice number": "DEMO-001",
    "Customer name": "Fictional Studio Ltd",
    "Issue date": "2026-11-01",
    "Due date": "2026-11-30",
    "Seller address": "1 Fictional Street, London",
    "Customer address": "2 Sample Road, London",
    "Description 1": "Design services",
    "Quantity 1": "2",
    "Unit price (£) 1": "123.45",
    "Line VAT (£) 1": "0",
  }))
    await dialog.getByLabel(label, { exact: true }).fill(value);
  await expect(dialog.getByText("£246.90")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("invoice-dialog.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Create draft invoice" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Remove item 2" }).click();
  await dialog.getByRole("button", { name: "Create draft invoice" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Draft", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Demo PDF · fictional data. Sign in to create public links.",
    ),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("invoice-created.png"), fullPage: true });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download DEMO-001 PDF" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("invoice-DEMO-001.pdf");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "DEMO-001", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .click();
  for (const [label, value] of Object.entries({
    "Invoice number": "DEMO-001",
    "Customer name": "Different Client",
    "Issue date": "2026-11-01",
    "Due date": "2026-11-30",
    "Seller address": "1 Fictional Street",
    "Customer address": "2 Sample Road",
    "Description 1": "Different work",
    "Unit price (£) 1": "100",
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Create draft invoice" }).click();
  await expect(page.getByRole("alert")).toContainText("already in use");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("cell", { name: "DEMO-001", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Bookkeeping", exact: true }).click();
  await expect(page.getByText("Fictional Studio Ltd")).toHaveCount(0);
});

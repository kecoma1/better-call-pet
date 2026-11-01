import { test, expect } from "@playwright/test";
test("review, post once, inspect ledger and open Saul", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your books, in good hands." }),
  ).toBeVisible();
  const overviewRow = page.getByRole("row", {
    name: "View expense details for Paper & Co.",
  });
  await overviewRow.getByRole("cell", { name: "£102.00" }).click();
  const details = page.getByRole("dialog", { name: "Paper & Co." });
  await expect(details).toContainText("£17.00");
  await expect(details).toContainText("PC-1042");
  await expect(details).toHaveCSS("position", "fixed");
  await expect
    .poll(async () => {
      const box = await details.boundingBox();
      return box ? Math.round(box.x + box.width) : 0;
    })
    .toBe(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Approve & post to books" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Bookkeeping", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "2201 · VAT recoverable" }),
  ).toHaveCount(2);
  const ledgerRow = page.getByRole("row", {
    name: "View journal details for Paper & Co., 5000 · Office supplies",
  });
  await ledgerRow.getByRole("cell", { name: "5000 · Office supplies" }).click();
  await expect(details).toContainText("Journal entry");
  await expect(
    page.getByRole("button", { name: "Already in your books" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(ledgerRow).toBeFocused();
  await page.getByRole("button", { name: /^Receipts/ }).click();
  const expenseRow = page.getByRole("row", {
    name: "View expense details for Paper & Co.",
  });
  await expenseRow.focus();
  await expenseRow.press("Space");
  await expect(
    page.getByRole("button", { name: "Already in your books" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Saul" })
    .fill("What needs attention?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/This is the demo workspace/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("reject duplicate sample and show blocked entertainment", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Add receipt", exact: true }).click();
  await page.getByRole("button", { name: /Use sample receipt/ }).click();
  await page.getByRole("button", { name: "Get VAT decision" }).click();
  await expect(page.getByRole("alert")).toContainText("already in your books");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("row", { name: "View expense details for The Ivy" })
    .getByRole("cell", { name: "Not deductible" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Not deductible");
  await expect(page.getByRole("dialog")).toContainText("UK business contacts");
});

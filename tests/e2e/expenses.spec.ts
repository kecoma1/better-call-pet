import { test, expect } from "@playwright/test";
test("review, post once, inspect ledger and open Saul", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your books, in good hands." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review Paper & Co." }).click();
  await expect(page.getByRole("dialog")).toContainText("£17.00");
  await page.getByRole("button", { name: "Approve & post to books" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Bookkeeping", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "2201 · VAT recoverable" }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: /^Receipts/ }).click();
  await page.getByRole("button", { name: "Review Paper & Co." }).click();
  await expect(
    page.getByRole("button", { name: "Already in your books" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
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
  await page.getByRole("button", { name: "Add receipt", exact: true }).click();
  await page.getByRole("button", { name: /Use sample receipt/ }).click();
  await page.getByRole("button", { name: "Get VAT decision" }).click();
  await expect(page.getByRole("alert")).toContainText("already in your books");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Review The Ivy" }).click();
  await expect(page.getByRole("dialog")).toContainText("Not deductible");
  await expect(page.getByRole("dialog")).toContainText("UK business contacts");
});

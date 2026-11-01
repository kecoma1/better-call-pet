import { expect, test } from "@playwright/test";
import { defaultCompany, demoReceipts } from "../../src/domain";

test("overview notifications open expenses and clear after approval", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Notifications" });
  await expect(banner.getByRole("heading")).toHaveText(
    "2 expenses are waiting for your approval.",
  );
  await banner.getByRole("button", { name: "Review next expense" }).click();
  await expect(page.getByRole("dialog", { name: "Paper & Co." })).toBeVisible();
  await page.getByRole("button", { name: "Approve & post to books" }).click();
  await expect(banner.getByRole("heading")).toHaveText(
    "An expense is waiting for your approval.",
  );
  await banner.getByRole("button", { name: "Review expense" }).click();
  await expect(page.getByRole("dialog", { name: "The Ivy" })).toBeVisible();
  await page.getByRole("button", { name: "Approve & post to books" }).click();
  await expect(banner.getByRole("heading")).toHaveText("You're all caught up.");
  await banner.getByRole("button", { name: "Open bookkeeping" }).click();
  await expect(page.getByRole("heading", { name: "The books." })).toBeVisible();
});

test("notification navigation surfaces missing evidence and VAT reviews", async ({
  page,
}) => {
  const receipts = [
    {
      ...demoReceipts[0],
      id: "missing",
      validInvoice: false,
      decision: { ...demoReceipts[0].decision, verdict: "review" },
    },
    {
      ...demoReceipts[0],
      id: "vat-review",
      decision: { ...demoReceipts[0].decision, verdict: "review" },
    },
    ...demoReceipts,
  ];
  await page.addInitScript(
    (data) => localStorage.setItem("bcp-demo-v1", JSON.stringify(data)),
    { company: defaultCompany, receipts },
  );
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Notifications" });
  await expect(banner.getByRole("heading")).toHaveText(
    "A receipt is missing its invoice.",
  );
  await banner.getByRole("button", { name: "Next notification" }).click();
  await expect(banner.getByRole("heading")).toHaveText(
    "One VAT decision needs a closer look.",
  );
  await banner.getByRole("button", { name: "Review VAT" }).click();
  await expect(
    page.getByRole("button", { name: "Approve & post to books" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await banner.getByRole("button", { name: "Next notification" }).click();
  await expect(banner.getByRole("heading")).toHaveText(
    "2 expenses are waiting for your approval.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

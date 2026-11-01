import { expect, test } from "@playwright/test";

test("starts on the full-page chat with animated pacing Saul", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Let’s talk business." })).toBeVisible();
  const saul = page.getByRole("img", { name: "Saul Goodman walking from left to right" });
  await expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.webp");
  await expect.poll(() => saul.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(416);
  await expect(saul).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Message Saul" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("keeps the conversation across pages and shows pacing Saul for a new conversation", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Message Saul" });
  await input.fill("What needs my attention?");
  await input.press("Enter");
  await expect(page.getByText(/This is the demo workspace/)).toBeVisible();
  await expect(page.getByRole("img", { name: /walking from left to right/ })).toHaveCount(0);
  await input.fill("Another question");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your books, in good hands." })).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByText(/This is the demo workspace/)).toBeVisible();
  await expect(input).toHaveValue("Another question");
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.getByRole("heading", { name: "Let’s talk business." })).toBeVisible();
  await expect(page.getByText(/This is the demo workspace/)).toHaveCount(0);
  await expect(page.getByRole("img", { name: /walking from left to right/ })).toBeInViewport({ ratio: 1 });
  await page.getByRole("button", { name: "What VAT can I reclaim?" }).click();
  await expect(page.getByText(/This is the demo workspace/)).toBeVisible();
  await expect(input).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("uses a still for reduced motion and recovers if the pacing animation cannot load", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const saul = page.getByRole("img", { name: /walking from left to right/ });
  await expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.png");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/chibi/saul-pacing.webp", (route) => route.abort());
  await page.reload();
  await expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.png");
  await expect.poll(() => saul.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(416);
});

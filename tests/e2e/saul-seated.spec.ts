import { test, expect, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.goto("/");
  const mobileSettings = page.getByRole("button", { name: "Open settings" });
  await (await mobileSettings.isVisible()
    ? mobileSettings
    : page.getByRole("button", { name: "Settings & connections" })).click();
}

test("seated smoking video plays over stationary Dots on desktop and mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openSettings(page);
  const brand = page.getByRole("link", { name: "Better Call Pet home" });
  const logo = brand.getByRole("img");
  await expect(logo).toHaveAttribute("src", "/chibi/saul-seated.webm");
  await expect(logo).toHaveCSS("width", "33px");
  await expect(logo).toHaveCSS("height", "33px");
  await expect.poll(() => logo.evaluate((element) => {
    const video = element as HTMLVideoElement;
    return video.readyState >= 2 && !video.paused && video.currentTime > 0;
  })).toBe(true);
  const collapse = page.getByRole("button", { name: "Collapse sidebar" });
  if (await collapse.isVisible()) {
    await collapse.click();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveCSS("width", "33px");
    await expect(logo).toHaveCSS("height", "33px");
    await page.getByRole("button", { name: "Expand sidebar" }).click();
  }
  const saul = page.getByRole("main").getByRole("img", { name: "Saul Goodman sitting with your Dots" });
  await saul.scrollIntoViewIfNeeded();
  await expect(saul).toBeVisible();
  await expect.poll(() => saul.evaluate((element) => {
    const video = element as HTMLVideoElement;
    return video.tagName === "VIDEO" && video.readyState >= 2 && !video.paused && video.currentTime > 0;
  })).toBe(true);
  const dots = page.getByRole("link", { name: "Connect Saul with your Dot" });
  const before = await dots.boundingBox();
  await dots.hover();
  expect(await dots.boundingBox()).toEqual(before);
  const scene = await page.locator(".dot-connect-scene").boundingBox();
  const seat = await saul.boundingBox();
  expect(scene).not.toBeNull();
  expect(seat!.y).toBeGreaterThan(scene!.y);
  expect(seat!.y + seat!.height).toBeLessThan(scene!.y + scene!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dots.click();
  await expect(page.getByRole("heading", { name: "Connect your Dot." })).toBeVisible();
});

test("reduced motion shows the seated still and failed video uses WebP", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSettings(page);
  const logo = page.getByRole("link", { name: "Better Call Pet home" }).getByRole("img");
  await expect(logo).toHaveAttribute("src", "/chibi/saul-seated.png");
  const saul = page.getByRole("main").getByRole("img", { name: "Saul Goodman sitting with your Dots" });
  await expect(saul).toHaveAttribute("src", "/chibi/saul-seated.png");
  await expect(page.locator("video.dot-connect-saul")).toHaveCount(0);
  await page.route("**/chibi/saul-seated.webm", (route) => route.abort());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(saul).toHaveAttribute("src", "/chibi/saul-seated.webp");
  await expect(logo).toHaveAttribute("src", "/chibi/saul-seated.webp");
});

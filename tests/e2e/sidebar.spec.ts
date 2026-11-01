import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 900, height: 620 },
  { width: 900, height: 480 },
  { width: 1280, height: 360 },
]) {
  test(`sidebar controls stay accessible at ${viewport.width}×${viewport.height}`, async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop sidebar layout");
    await page.setViewportSize(viewport);
    await page.goto("/");
    const sidebar = page.getByRole("complementary");
    const navigation = sidebar.getByRole("navigation", {
      name: "Main navigation",
    });
    const settings = sidebar.getByRole("button", {
      name: "Settings & connections",
    });
    const signIn = sidebar.getByRole("button", { name: "Sign in", exact: true });

    await expect(sidebar).not.toContainText("Small business.");
    await expect(
      sidebar.getByRole("button", { name: "Add your next receipt" }),
    ).toHaveCount(0);
    await expect(settings).toBeInViewport({ ratio: 1 });
    await expect(signIn).toBeInViewport({ ratio: 1 });
    await expect(
      sidebar.getByText("Demo workspace", { exact: true }),
    ).toBeInViewport({ ratio: 1 });

    // Short windows scroll the navigation without shrinking its hit targets.
    const vat = navigation.getByRole("button", { name: "VAT", exact: true });
    await vat.focus();
    await expect(vat).toBeInViewport({ ratio: 1 });
    await expect(vat).toHaveCSS("height", "41px");
    await expect(settings).toBeInViewport({ ratio: 1 });
    const navigationBox = (await navigation.boundingBox())!;
    const settingsBox = (await settings.boundingBox())!;
    expect(navigationBox.y + navigationBox.height).toBeLessThanOrEqual(
      settingsBox.y,
    );
    await vat.press("Enter");
    await expect(vat).toHaveAttribute("aria-current", "page");

    await settings.click();
    await expect(
      page.getByRole("heading", { name: "Your workspace." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(settings).toBeInViewport({ ratio: 1 });
    await expect(signIn).toBeInViewport({ ratio: 1 });
    await navigation.getByRole("button", { name: "Overview", exact: true }).click();
    await settings.click();
    await expect(
      page.getByRole("heading", { name: "Your workspace." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Expand sidebar" }),
    ).toBeVisible();
    await expect(settings).toBeInViewport({ ratio: 1 });
    await expect(signIn).toBeInViewport({ ratio: 1 });
  });
}

test("mobile navigation scrolls horizontally and keeps settings accessible", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile navigation layout");
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const vat = navigation.getByRole("button", { name: "VAT", exact: true });
  await vat.click();
  await expect(vat).toBeInViewport({ ratio: 1 });
  await expect(vat).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

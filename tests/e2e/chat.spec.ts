import { test, expect, type Page } from "@playwright/test";

async function showHistory(page: Page) {
  if (
    !(await page
      .getByRole("navigation", { name: "Conversation history" })
      .isVisible())
  ) {
    await page.getByRole("button", { name: "Show conversations" }).click();
  }
}
async function openWorkspace(page: Page) {
  await showHistory(page);
  await page.getByRole("button", { name: "Open workspace" }).click();
}

test("chat fills the screen with its own layout and the existing pacing animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Let’s talk books." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await expect(page.locator(".topbar")).toHaveCount(0);
  const shell = await page.locator(".chat-page").boundingBox();
  expect(shell?.x).toBe(0);
  expect(shell?.y).toBe(0);
  expect(shell?.width).toBe(page.viewportSize()!.width);
  expect(shell?.height).toBe(page.viewportSize()!.height);
  const saul = page.getByRole("img", {
    name: "Saul Goodman walking from left to right",
  });
  await expect(saul).toHaveAttribute("src", "/chibi/saul-pacing.webp");
  await expect
    .poll(() => saul.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(416);
  await expect(saul).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel("Message Saul")).toBeInViewport({ ratio: 1 });
  await page.getByRole("button", { name: "What needs my attention?" }).click();
  await expect(
    page.getByRole("article", { name: "Saul’s reply" }),
  ).toContainText("This is the demo workspace");
  await expect(saul).toHaveCount(0);
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(saul).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("preserves drafts, tools and saved history across the two layouts", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Message Saul");
  await input.fill("What VAT can I reclaim?");
  await input.press("Enter");
  const reply = page.getByRole("article", { name: "Saul’s reply" }).last();
  await expect(reply).toContainText("This is the demo workspace");
  await expect(reply).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByLabel("Demo tool examples")).toContainText(
    "Receipts listed",
  );
  await input.fill("Keep this draft");
  await openWorkspace(page);
  await expect(
    page.getByRole("heading", { name: "Your books, in good hands." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(input).toHaveValue("Keep this draft");
  await page.getByRole("button", { name: "Open receipt Paper & Co." }).click();
  await expect(page.getByRole("dialog")).toContainText("Paper & Co.");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(input).toHaveValue("");
  await input.fill("List my receipts");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(reply).toContainText("This is the demo workspace");
  await page.reload();
  await showHistory(page);
  const history = page.getByRole("navigation", {
    name: "Conversation history",
  });
  await expect(history.getByRole("button")).toHaveCount(2);
  await history
    .getByRole("button", { name: /VAT.*What VAT can I reclaim/ })
    .click();
  if (isMobile) await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("What VAT can I reclaim?");
  await expect(page.getByRole("log").locator(".chat-word")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("filters and searches all five conversation topics", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "bcp-demo-chats-v1",
      JSON.stringify(
        [
          "VAT",
          "Bookkeeping",
          "Annual accounts",
          "Corporate Tax",
          "Receipts",
        ].map((topic, index) => ({
          id: "demo-" + index,
          title: topic + " question",
          topic,
          provider: "demo-rules",
          preview: "Demo accounting guidance",
          updatedAt: "2026-11-01T12:00:00.000Z",
          messages: [
            { role: "user", content: topic + " question" },
            { role: "assistant", content: "Demo accounting guidance" },
          ],
        })),
      ),
    );
  });
  await page.goto("/");
  await showHistory(page);
  const history = page.getByRole("navigation", {
    name: "Conversation history",
  });
  await expect(history.getByRole("button")).toHaveCount(5);
  const filters = page.getByRole("group", {
    name: "Filter conversations by topic",
  });
  for (const topic of [
    "VAT",
    "Bookkeeping",
    "Annual accounts",
    "Corporate Tax",
    "Receipts",
  ]) {
    await filters.getByRole("button", { name: topic, exact: true }).click();
    await expect(history.getByRole("button")).toHaveCount(1);
  }
  await filters.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search conversations").fill("not-a-conversation");
  await expect(
    page.getByText("No conversations match your search."),
  ).toBeVisible();
  await page.getByLabel("Search conversations").fill("Corporate Tax");
  await expect(history.getByRole("button")).toHaveCount(1);
});

test("renders Markdown questions and replies including wide code and tables", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "bcp-demo-chats-v1",
      JSON.stringify([
        {
          id: "markdown-demo",
          title: "Markdown conversation",
          topic: "VAT",
          provider: "demo-rules",
          preview: "Formatted accounting guidance",
          updatedAt: "2026-11-01T12:00:00.000Z",
          messages: [
            {
              role: "user",
              content:
                "## My question\n\nCheck **this invoice**.\n\n- Software\n- Equipment",
            },
            {
              role: "assistant",
              content:
                "## VAT summary\n\nKeep **the original**.\n\n| Expense | VAT |\n| --- | ---: |\n| Software | £20.00 |\n\n```text\n" +
                "very_long_reference_".repeat(15) +
                "\n```\n\n[Guidance](https://example.com/invoices)",
            },
          ],
        },
      ]),
    );
  });
  await page.goto("/");
  await showHistory(page);
  await page
    .getByRole("navigation", { name: "Conversation history" })
    .getByRole("button")
    .click();
  const user = page.getByRole("article", { name: "Your message" });
  const reply = page.getByRole("article", { name: "Saul’s reply" });
  await expect(
    user.getByRole("heading", { name: "My question" }),
  ).toBeVisible();
  await expect(user.getByRole("listitem")).toHaveCount(2);
  await expect(
    reply.getByRole("heading", { name: "VAT summary" }),
  ).toBeVisible();
  await expect(reply.getByRole("cell", { name: "£20.00" })).toBeVisible();
  await expect(reply.getByRole("link", { name: "Guidance" })).toHaveAttribute(
    "href",
    "https://example.com/invoices",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Message Saul").fill("**Please** check my VAT");
  await page.getByLabel("Message Saul").press("Enter");
  await expect(
    page
      .getByRole("article", { name: "Your message" })
      .last()
      .locator("strong"),
  ).toHaveText("Please");
});

test("preserves word fades and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByLabel("Message Saul").fill("Bookkeeping help");
  await page.getByRole("button", { name: "Send message" }).click();
  const words = page.getByRole("log").locator(".chat-word");
  await expect(words.first()).toBeVisible();
  expect(
    await words
      .nth(1)
      .evaluate((word) => getComputedStyle(word).animationDelay),
  ).toBe("0.024s");
  await expect(words.last()).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(
    page.getByRole("img", { name: /walking from left to right/ }),
  ).toHaveAttribute("src", "/chibi/saul-pacing.png");
  await page.getByLabel("Message Saul").fill("Receipts help");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(words.last()).toHaveCSS("animation-name", "none");
  await expect(words.last()).toHaveCSS("opacity", "1");
});

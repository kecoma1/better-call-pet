import { test, expect } from "@playwright/test";

test("saved company lookups stay collapsed while receipts and answers remain visible", async ({ page }) => {
  await page.addInitScript(() => {
    const company = {
      name: "Your LTD",
      vatRegistered: false,
      yearEnd: "2027-03-31",
    };
    localStorage.setItem("bcp-demo-chats-v1", JSON.stringify([{
      id: "demo-company-context",
      title: "Recibos de prueba",
      topic: "Receipts",
      provider: "demo-rules",
      preview: "Envíame los recibos de prueba.",
      updatedAt: "2026-11-01T12:00:00.000Z",
      messages: [
        { role: "user", content: "Hola" },
        { role: "assistant", content: "Hola, ¿en qué te ayudo?", tools: [{ name: "get_company", company }] },
        { role: "user", content: "¿Podemos añadir recibos de prueba?" },
        {
          role: "assistant",
          content: "Envíame los recibos de prueba.",
          tools: [
            { name: "get_company", company },
            { name: "list_receipts", receipts: [], receiptCount: 0 },
          ],
        },
      ],
    }]));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("navigation", { name: "Conversation history" })
    .getByRole("button", { name: /Recibos de prueba/ }).click();
  const log = page.getByRole("log");
  const replies = log.getByRole("article", { name: "Saul’s reply" });
  await expect(replies).toHaveCount(2);
  await expect(replies.last()).toContainText("Envíame los recibos de prueba.");
  await expect(replies.last().getByText("No receipts found.")).toBeVisible();
  await expect(log.getByText("Your LTD", { exact: true })).toHaveCount(0);
  const lookup = replies.last().getByRole("button", { name: /Company checked/ });
  await expect(lookup).toHaveAttribute("aria-expanded", "false");
  await lookup.focus();
  await page.keyboard.press("Enter");
  await expect(lookup).toHaveAttribute("aria-expanded", "true");
  await expect(replies.last().getByText("Your LTD", { exact: true })).toBeVisible();
  await expect(replies.last().getByText("2027-03-31", { exact: true })).toBeVisible();
  await expect(replies.first().getByText("Your LTD", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(lookup).toHaveAttribute("aria-expanded", "false");
  await expect(log.getByText("Your LTD", { exact: true })).toHaveCount(0);
});

test("floating chat expands into persistent history with topic badges and receipt cards", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your books, in good hands." }),
  ).toBeVisible();
  const launcher = page.getByRole("button", { name: "Open chat with Saul" });
  await expect(launcher).toBeVisible();
  await expect(launcher.getByRole("img")).toBeVisible();
  await expect(launcher.getByRole("img")).toHaveAttribute(
    "src",
    "/chibi/saul-smoking.webp",
  );
  await expect
    .poll(() =>
      launcher.getByRole("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("Better call Saul.", { exact: true }),
  ).toHaveCount(0);
  await launcher.click();
  await page
    .getByRole("textbox", { name: "Message Saul" })
    .fill("What VAT can I reclaim?");
  await page.getByRole("button", { name: "Send message" }).click();
  const reply = page.getByRole("article", { name: "Saul’s reply" }).last();
  await expect(reply).toContainText("This is the demo workspace");
  await expect(reply).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(reply).toHaveCSS("border-top-width", "0px");
  await expect(page.getByLabel("Demo tool examples")).toContainText(
    "Receipts listed",
  );
  await expect(reply.getByText("£102.00", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message Saul" })
    .fill("Keep this draft");
  await page.getByRole("button", { name: "Open all conversations" }).click();
  await expect(
    page.getByRole("heading", { name: "Let’s talk books." }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Saul")).toHaveValue("Keep this draft");
  const history = page.getByRole("navigation", {
    name: "Conversation history",
  });
  await expect(history.getByRole("button")).toHaveCount(1);
  await expect(history).toContainText("VAT");
  await page.getByRole("button", { name: "Open receipt Paper & Co." }).click();
  await expect(page.getByRole("dialog")).toContainText("Paper & Co.");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "New conversation" }).click();
  await expect(page.getByLabel("Message Saul")).toHaveValue("");
  await page.getByLabel("Message Saul").fill("List my receipts");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(history.getByRole("button")).toHaveCount(2);
  await expect(history).toContainText("Receipts");
  await page.reload();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(history.getByRole("button")).toHaveCount(2);
  await history
    .getByRole("button", { name: /VAT.*What VAT can I reclaim/ })
    .click();
  await expect(page.getByRole("log")).toContainText("What VAT can I reclaim?");
  await expect(page.getByRole("log").locator(".chat-word")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("all five topics can be filtered and searched", async ({ page }) => {
  await page.addInitScript(() => {
    const topics = [
      "VAT",
      "Bookkeeping",
      "Annual accounts",
      "Corporate Tax",
      "Receipts",
    ];
    localStorage.setItem(
      "bcp-demo-chats-v1",
      JSON.stringify(
        topics.map((topic, index) => ({
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
  await page.getByRole("button", { name: "Chat", exact: true }).click();
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
    await expect(history).toContainText(topic + " question");
  }
  await filters.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Search conversations").fill("year-end-does-not-exist");
  await expect(
    page.getByText("No conversations match your search."),
  ).toBeVisible();
  await page.getByLabel("Search conversations").fill("Corporate Tax");
  await expect(history.getByRole("button")).toHaveCount(1);
});

test("word fades advance quickly and reduced motion displays new answers immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
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
  await page.getByRole("button", { name: "New conversation" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("Message Saul").fill("Receipts help");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(words.last()).toHaveCSS("animation-name", "none");
  await expect(words.last()).toHaveCSS("opacity", "1");
});

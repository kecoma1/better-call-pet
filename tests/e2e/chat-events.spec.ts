import { expect, test } from "@playwright/test";

test("shows Firestore activity, tools and text before the chat request completes", async ({
  page,
}) => {
  await page.route("**/src/firebase.ts", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'export const auth = { currentUser: { uid: "synthetic-member", getIdToken: async () => "synthetic-token" } }; export const db = null;',
    }),
  );
  await page.route("**/src/services/chat-events.ts", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export function watchChatRun(conversationId, requestId, receive, error) { let active = true; window.emitRun = run => { if(active) receive(run); }; window.failRun = () => error(Error("Live updates are unavailable.")); window.listenerDetached = false; return () => { active = false; window.listenerDetached = true; }; }`,
    }),
  );
  await page.route("**/api/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  let request: { conversationId: string; requestId: string } | undefined;
  let finish!: () => void;
  const hold = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    request = route.request().postDataJSON();
    await hold;
    await route.fulfill({
      json: {
        conversation: {
          id: request!.conversationId,
          title: "Check my VAT",
          topic: "VAT",
          preview: "Final live reply",
          updatedAt: "2026-11-01T12:00:00.000Z",
          provider: "openai-decisions",
          messages: [
            { role: "user", content: "Check my VAT" },
            {
              role: "assistant",
              content: "Final **live** reply",
              activity: [
                {
                  sequence: 0,
                  kind: "completed",
                  at: "2026-11-01T12:00:00.000Z",
                },
              ],
            },
          ],
        },
      },
    });
  });
  await page.goto("/tests/e2e/fixtures/chat-events.html");
  await page.getByLabel("Message Saul").fill("Check my VAT");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => Boolean(request)).toBe(true);
  const base = {
    ...request!,
    createdBy: "synthetic-member",
    status: "running",
    updatedAt: "2026-11-01T12:00:00.000Z",
    content: "",
    tools: [],
    events: [
      { sequence: 0, kind: "classifying", at: "2026-11-01T12:00:00.000Z" },
    ],
  };
  await page.evaluate((run) => (window as any).emitRun(run), base);
  await expect(page.getByText("Classifying your question")).toBeVisible();
  await page.evaluate(
    (run) =>
      (window as any).emitRun({
        ...run,
        events: [
          ...run.events,
          {
            sequence: 1,
            kind: "tool_started",
            tool: "get_company",
            at: run.updatedAt,
          },
        ],
      }),
    base,
  );
  await expect(page.getByText("Checking company details")).toBeVisible();
  await page.evaluate(
    (run) =>
      (window as any).emitRun({
        ...run,
        content: "Partial **live** reply",
        tools: [
          {
            name: "get_company",
            company: {
              name: "Fictional Company",
              vatRegistered: true,
              yearEnd: "2027-03-31",
            },
          },
        ],
        events: [
          ...run.events,
          {
            sequence: 1,
            kind: "tool_completed",
            tool: "get_company",
            at: run.updatedAt,
          },
          { sequence: 2, kind: "responding", at: run.updatedAt },
        ],
      }),
    base,
  );
  const reply = page.getByRole("article", { name: "Saul’s reply" });
  await expect(reply).toContainText("Partial live reply");
  await expect(
    reply.locator("strong").filter({ hasText: "live" }),
  ).toBeVisible();
  await expect(page.getByText("Fictional Company")).toBeVisible();
  await expect(page.getByText("Writing reply")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  finish();
  await expect(reply).toHaveCount(1);
  await expect(reply).toContainText("Final live reply");
  await expect(page.getByText("Partial live reply")).toHaveCount(0);
  await expect(page.getByText("Activity", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).listenerDetached))
    .toBe(true);
});

import { test, expect, type Page } from "@playwright/test";

async function liveFixture(page: Page, denied = false, hold = false, anonymous = false) {
  // Only fixture auth/workspace are replaced. The real voice service, stream
  // parser, UI, audio cleanup and chat transcript run in the browser.
  await page.route("**/src/firebase.ts", (route) => route.fulfill({ contentType: "application/javascript", body: `export const auth = { currentUser: { getIdToken: async () => "fixture-token" } }; export const currentWorkspaceUser = () => auth.currentUser; export async function signIn() {}` }));
  await page.route("**/src/hooks/use-workspace.ts", (route) => route.fulfill({ contentType: "application/javascript", body: `
    import { defaultCompany, demoReceipts } from "/src/domain.ts";
    const noop = async () => {};
    export function useWorkspace() { return { user: { uid: "fixture-member", displayName: ${anonymous ? 'null' : '"Fixture"'}, isAnonymous: ${anonymous} }, company: defaultCompany, items: demoReceipts, invoices: [], loading: false, error: "", setError: noop, refresh: noop, add: noop, addInvoice: noop, post: noop, save: noop, login: noop, logout: noop }; }
  ` }));
  let conversation: unknown[] = [];
  await page.route("**/api/conversation", (route) => {
    if (route.request().method() === "POST") conversation = route.request().postDataJSON().messages;
    return route.fulfill({ json: route.request().method() === "POST" ? { ok: true } : conversation });
  });
  await page.addInitScript(({ denied, hold }) => {
    const state = { stopped: 0, peerClosed: 0, sent: [] as string[], enabled: true };
    (window as any).callFixture = state;
    const track = { get enabled() { return state.enabled; }, set enabled(value: boolean) { state.enabled = value; }, stop() { state.stopped++; } };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { if (denied) throw new DOMException("Denied", "NotAllowedError"); return { getTracks: () => [track], getAudioTracks: () => [track] }; } } });
    (window as any).RTCPeerConnection = class {
      connectionState = "new"; onconnectionstatechange: (() => void) | null = null;
      createDataChannel() { return { readyState: "open", send(data: string) { state.sent.push(data); }, close() {} }; }
      addTrack() {} async createOffer() { return { type: "offer", sdp: "v=0\r\nfixture" }; }
      async setLocalDescription() {}
      async setRemoteDescription() { this.connectionState = "connected"; this.onconnectionstatechange?.(); }
      close() { state.peerClosed++; }
    };
    if (hold) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (!String(args[0]).endsWith("/api/voice")) return response;
        return new Response(new ReadableStream({ async start(controller) {
          args[1]?.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
          const reader = response.body!.getReader();
          while (true) { const part = await reader.read(); if (part.done) break; controller.enqueue(part.value); }
        } }), { headers: response.headers });
      };
    }
  }, { denied, hold });
  await page.route("**/api/voice", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer fixture-token");
    const events = [
      { type: "connected", sdp: "fixture-answer" },
      { type: "transcript", role: "user", text: "What needs my attention?", startMs: 0, endMs: 500 },
      { type: "transcript", role: "assistant", text: "Two receipts are waiting for review.", startMs: 600, endMs: 1500 },
      // Keep the real reader pending so mute, hang-up and Escape can be tested.
    ];
    await route.fulfill({ contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" });
  });
}

test("offline demo explains that calls need a configured backend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByRole("button", { name: "Call Saul" })).toBeDisabled();
});

test("call connects directly, shows captions and keeps the transcript after cleanup", async ({ page }) => {
  await liveFixture(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await page.getByRole("button", { name: "Call Saul" }).click();
  const dialog = page.getByRole("dialog", { name: "Better call Saul." });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Live captions" })).toContainText("Two receipts are waiting for review.");
  // EOF without ended is an explicit failure; no demo answer replaces it.
  await expect(dialog.getByRole("alert")).toContainText("Voice connection lost");
  await expect(dialog.locator(".voice-saul")).toHaveAttribute("src", "/chibi/saul-phone.webp");
  await expect.poll(() => page.evaluate(() => (window as any).callFixture.stopped)).toBe(1);
  await expect(dialog).not.toContainText("terms");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/voice-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "Back to chat" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("region", { name: "Chat with Saul" })).toContainText("Two receipts are waiting for review.");
  await expect(page.getByRole("button", { name: "Call Saul" })).toBeFocused();
});

test("blocked microphone shows a recoverable error and reduced motion uses a still", async ({ page }) => {
  await liveFixture(page, true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await page.getByRole("button", { name: "Call Saul" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("Microphone access is blocked");
  await expect(dialog.locator(".voice-saul")).toHaveAttribute("src", "/chibi/saul-phone.png");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("mute, unmute and hang-up stop capture and return focus to the chat", async ({ page }) => {
  await liveFixture(page, false, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await page.getByRole("button", { name: "Call Saul" }).click();
  await page.getByRole("button", { name: "Mute microphone" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).callFixture.enabled)).toBe(false);
  await page.getByRole("button", { name: "Unmute microphone" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).callFixture.enabled)).toBe(true);
  await page.screenshot({ path: `artifacts/voice-active-${test.info().project.name}.png` });
  await page.getByRole("button", { name: "End call" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).callFixture.stopped)).toBe(1);
  await expect(page.getByRole("button", { name: "Call Saul" })).toBeFocused();
  await expect(page.getByRole("region", { name: "Chat with Saul" })).toContainText("Two receipts are waiting for review.");
});

test("anonymous demo calls use the real voice transport and restore captions after reload", async ({ page }) => {
  await liveFixture(page, false, false, true);
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("Demo workspace", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByRole("button", { name: "Call Saul" })).toBeEnabled();
  await page.getByRole("button", { name: "Call Saul" }).click();
  await page.getByRole("button", { name: "Back to chat" }).click();
  await expect(page.getByRole("region", { name: "Chat with Saul" })).toContainText("Two receipts are waiting for review.");
  await page.reload();
  await page.getByRole("button", { name: "Open chat with Saul" }).click();
  await expect(page.getByRole("region", { name: "Chat with Saul" })).toContainText("Two receipts are waiting for review.");
});

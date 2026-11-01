// Opt-in paid provider smoke: synthetic speech, fixture auth and fixture books.
// RUN_VOICE_LIVE=1 npm run test:voice:live
import express from "express";
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ reads: new Set<string>(), closed: false }));
vi.mock("firebase-functions/logger", () => ({
  info: (name: string, details: { closed?: boolean }) => { if (name === "voice.ended") state.closed = details.closed === true; },
  warn: vi.fn(),
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => { if (token !== "fixture-token") throw Error("Invalid"); return { uid: "voice-smoke-member" }; } }) }));
vi.mock("firebase-admin/firestore", async () => {
  const { defaultCompany, demoReceipts } = await import("../../src/domain");
  const ref = (name: string) => ({ get: async () => ({ exists: true, data: () => name === "users" ? { active: true } : name === "companies" ? defaultCompany : { count: 0 } }) });
  return { getFirestore: () => ({
    collection: (name: string) => ({ doc: () => ref(name), orderBy: () => ({ limit: () => ({ get: async () => { state.reads.add(name); return { docs: demoReceipts.map((r) => ({ data: () => r })) }; } }) }) }),
    runTransaction: async (fn: any) => fn({ get: async () => ({ data: () => ({ count: 0 }) }), set: () => undefined }),
  }) };
});
import { setTracingDisabled } from "@openai/agents";
import { voiceCall } from "../src/voice";
import { firebaseUser } from "../src/oauth";

it.skipIf(process.env.RUN_VOICE_LIVE !== "1")("real GPT-Live audio delegates to gpt-6-luna and shared receipt tools", async () => {
  setTracingDisabled(true);
  expect(process.env.OPENAI_API_KEY).toBeTruthy();
  await mkdir("artifacts", { recursive: true });
  const stage = async (text: string) => { await appendFile("artifacts/voice-live-stages.log", text + "\n"); };
  await stage("preparing synthetic audio");
  execFileSync("say", ["-v", "Samantha", "-r", "150", "-o", "artifacts/voice-question.aiff", "Please check my actual books. How many receipts are waiting for review?"]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "artifacts/voice-question.aiff", "artifacts/voice-question.wav"]);
  const app = express(); app.use(express.json({ limit: "1mb" }));
  app.post("/api/voice", firebaseUser, voiceCall);
  app.get("/question.wav", async (_q, r) => r.type("audio/wav").send(await readFile("artifacts/voice-question.wav")));
  app.get("/", (_q, r) => r.type("html").send("<!doctype html><title>Voice provider smoke</title>"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  await stage("launching browser");
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage();
    await stage("opening synthetic call page");
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}`);
    await page.evaluate(async () => {
      const events: any[] = []; (window as any).voiceSmoke = { events, failure: "", peak: 0, audioSent: false };
      const state = (window as any).voiceSmoke;
      const peer = new RTCPeerConnection(), channel = peer.createDataChannel("oai-events");
      const context = new AudioContext(), destination = context.createMediaStreamDestination();
      const silence = context.createConstantSource(); silence.offset.value = 0; silence.connect(destination); silence.start();
      peer.addTrack(destination.stream.getAudioTracks()[0], destination.stream);
      const ready = new Promise<void>((resolve) => { channel.onopen = () => resolve(); });
      peer.ontrack = (event) => {
        const playback = new Audio(); playback.autoplay = true; playback.volume = 0;
        playback.srcObject = event.streams[0]; document.body.append(playback);
        void playback.play().catch(() => { state.failure = "Remote audio playback failed"; });
        const source = context.createMediaStreamSource(event.streams[0]);
        const capture = context.createScriptProcessor(2048, 1, 1);
        capture.onaudioprocess = (part) => { for (const sample of part.inputBuffer.getChannelData(0)) state.peak = Math.max(state.peak, Math.abs(sample)); part.outputBuffer.getChannelData(0).fill(0); };
        source.connect(capture); capture.connect(context.destination);
      };
      const abort = new AbortController();
      (window as any).closeVoiceSmoke = () => { if (channel.readyState === "open") channel.send(JSON.stringify({ type: "session.close" })); };
      (window as any).releaseVoiceSmoke = () => { abort.abort(); peer.close(); silence.stop(); destination.stream.getTracks().forEach((t) => t.stop()); void context.close(); };
      const audio = await context.decodeAudioData(await (await fetch("/question.wav")).arrayBuffer());
      await peer.setLocalDescription(await peer.createOffer());
      void (async () => {
        const response = await fetch("/api/voice", { method: "POST", signal: abort.signal, headers: { Authorization: "Bearer fixture-token", "Content-Type": "application/json" }, body: JSON.stringify({ sdp: peer.localDescription!.sdp, language: "English" }) });
        if (!response.ok) throw Error("Call HTTP " + response.status);
        const reader = response.body!.getReader(), decoder = new TextDecoder(); let buffer = "";
        while (true) {
          const part = await reader.read(); if (part.done) break;
          buffer += decoder.decode(part.value, { stream: true }); let boundary: number;
          while ((boundary = buffer.indexOf("\n")) >= 0) {
            const event = JSON.parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1);
            if (event.type === "connected") {
              await peer.setRemoteDescription({ type: "answer", sdp: event.sdp }); await ready; await context.resume();
              const source = context.createBufferSource(); source.buffer = audio; source.connect(destination); source.start(context.currentTime + 1); state.audioSent = true;
            }
            const { sdp: _sdp, ...safe } = event; events.push(safe);
          }
        }
      })().catch((error) => { if (!abort.signal.aborted) state.failure = error.message; });
    });
    await stage("synthetic call running");
    await page.waitForFunction(() => {
      const s = (window as any).voiceSmoke;
      const text = s.events.filter((e: any) => e.type === "transcript" && e.role === "assistant").map((e: any) => e.text).join("");
      return s.failure || s.events.some((e: any) => e.type === "error") || (/two|2/i.test(text) && s.peak > 0.001 && s.events.some((e: any) => e.type === "working"));
    }, undefined, { timeout: 45000 }).catch(async (error) => {
      const result = await page.evaluate(() => (window as any).voiceSmoke);
      await stage("call failed: " + JSON.stringify(result));
      throw error;
    });
    const result = await page.evaluate(() => (window as any).voiceSmoke);
    await stage("call received response: " + JSON.stringify({ failure: result.failure, events: result.events.map((e: any) => e.type), peak: result.peak, collections: [...state.reads] }));
    expect(result.failure).toBe(""); expect(result.events.filter((e: any) => e.type === "error")).toEqual([]);
    expect(state.reads.has("expenses")).toBe(true); expect(result.peak).toBeGreaterThan(0.001);
    const spoken = result.events.filter((e: any) => e.type === "transcript" && e.role === "assistant").map((e: any) => e.text).join("");
    expect(spoken).toMatch(/two|2/i);
    await page.evaluate(() => (window as any).closeVoiceSmoke());
    await page.waitForFunction(() => (window as any).voiceSmoke.events.some((e: any) => e.type === "ended"), undefined, { timeout: 20000 });
    expect(state.closed).toBe(true);
    await stage("provider close confirmed; stream ended");
  } finally {
    await stage("releasing browser and local server");
    const page = browser.contexts()[0]?.pages()[0];
    if (page) {
      await page.evaluate(() => (window as any).closeVoiceSmoke?.()).catch(() => undefined);
      await page.waitForFunction(() => (window as any).voiceSmoke?.events.some((e: any) => e.type === "ended"), undefined, { timeout: 15000 }).catch(() => undefined);
      await page.evaluate(() => (window as any).releaseVoiceSmoke?.()).catch(() => undefined);
    }
    await browser.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 110000);

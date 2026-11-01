import type { Request, Response } from "express";
import { z } from "zod";
import { info, warn } from "firebase-functions/logger";
import { runSaul } from "./agent.js";
import { aiQuota } from "./tools.js";
import { requireInternal } from "./oauth.js";
import { mergeCallCaption, type CallCaption, type VoiceEvent } from "../../src/lib/voice.js";
import { readTranscript, liveDelegationId, liveResultChunks } from "./voice-protocol.js";
import { createLiveSession, attachLiveSession, closeLiveSession, type LiveConnection } from "./voice-transport.js";

const payload = z.object({
  sdp: z.string().startsWith("v=0").max(100000),
  language: z.enum(["English", "Spanish"]).default("English"),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(5000) })).max(16).default([]),
});

export async function voiceCall(q: Request, r: Response) {
  const input = payload.parse(q.body);
  await aiQuota(r.locals.uid);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Error("Voice calls are not configured on the server.");
  const uid = r.locals.uid as string;
  const abort = new AbortController();
  let connection: LiveConnection | undefined;
  let sessionId: string | undefined;
  let closed = false;
  let failed = false;
  let streaming = false;
  let revision = 0;
  let transcriptBytes = 0;
  let captions: CallCaption[] = [];
  let work = Promise.resolve();
  let delegated: AbortController | undefined;
  let pendingId: string | null = null;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  const stop = () => { abort.abort(); delegated?.abort(); finish(); };
  const emit = (event: VoiceEvent) => {
    if (r.destroyed || r.writableEnded) { stop(); return; }
    r.write(JSON.stringify(event) + "\n");
  };
  r.on("close", stop);
  const timeout = setTimeout(stop, 480000);
  const membership = setInterval(() => { void requireInternal(uid).catch(() => { failed = true; stop(); }); }, 15000);
  info("voice.started", { uid });
  try {
    const session = await createLiveSession(key, input.sdp, "gpt-live-1", input.language);
    sessionId = session.id;
    abort.signal.throwIfAborted();
    connection = await attachLiveSession(key, session.id, (event) => {
      if (event.type === "session.closed") { closed = true; stop(); return; }
      if (event.type === "error") { failed = true; stop(); return; }
      const fragment = readTranscript(event);
      if (fragment) {
        transcriptBytes += Buffer.byteLength(fragment.text);
        if (transcriptBytes > 128000) { stop(); return; }
        captions = mergeCallCaption(captions, fragment);
        if (fragment.role === "user") { revision++; delegated?.abort(); }
        emit({ type: "transcript", ...fragment });
      }
      const notice = liveDelegationId(event);
      if (notice && seen.has(notice)) return;
      if (notice) { pendingId = notice; seen.add(notice); }
      const id = pendingId;
      if (!id || abort.signal.aborted || (!notice && fragment?.role !== "user")) return;
      delegated?.abort();
      const task = new AbortController();
      delegated = task;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        work = work.then(async () => {
          if (task.signal.aborted || abort.signal.aborted) return;
          const current = revision;
          const history = [...input.messages, ...captions.map((c) => ({ role: c.role, content: c.text.slice(-5000) }))].slice(-16);
          if (!history.some((m) => m.role === "user" && m.content.trim())) return;
          emit({ type: "working" });
          const taskTimeout = setTimeout(() => task.abort(), 90000);
          try {
            await requireInternal(uid);
            await aiQuota(uid);
            const message = await runSaul(uid, history, task.signal);
            if (abort.signal.aborted) return;
            const currentResult = current === revision && !task.signal.aborted;
            if (currentResult && pendingId === id) pendingId = null;
            for (const content of liveResultChunks("Verified backend result: " + message)) {
              connection?.send({ type: currentResult ? "session.commentary.append" : "session.thinking.append", delegation_id: id, content });
            }
          } catch {
            if (!task.signal.aborted && !abort.signal.aborted) connection?.send({ type: "session.commentary.append", delegation_id: id,
              content: "The backend request failed. Do not invent results or claim changes succeeded. Ask the user to try again." });
          } finally {
            clearTimeout(taskTimeout);
            if (!abort.signal.aborted) emit({ type: "listening" });
          }
        }).catch(() => { failed = true; stop(); });
      }, 750);
    }, () => { if (!closed) failed = true; stop(); });
    abort.signal.throwIfAborted();
    r.status(200).set({ "Content-Type": "application/x-ndjson", "X-Accel-Buffering": "no" });
    r.flushHeaders();
    streaming = true;
    emit({ type: "connected", sdp: session.sdp });
    await finished;
    if (failed) emit({ type: "error", message: "Voice connection lost. Please call again." });
  } catch {
    if (!r.destroyed) {
      if (streaming) emit({ type: "error", message: "Saul could not finish the call. Please try again." });
      else r.status(502).json({ error: "Saul could not start the call. Please try again." });
    }
    warn("voice.failed", { uid });
  } finally {
    clearTimeout(timeout);
    clearTimeout(debounce);
    clearInterval(membership);
    stop();
    // Close through the trusted sideband and wait for the provider's final event.
    // A second attach also handles startup failure after session creation.
    if (sessionId && !closed) {
      const seconds = await closeLiveSession(key, sessionId);
      closed = seconds !== null;
      if (!closed) warn("voice.close_unconfirmed", { uid, sessionId });
    }
    connection?.disconnect();
    await work;
    if (streaming && !r.destroyed && !r.writableEnded) { emit({ type: "ended" }); r.end(); }
    r.off("close", stop);
    info("voice.ended", { uid, closed });
  }
}

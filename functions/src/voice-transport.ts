import WebSocket from "ws";
import { eventDemoInstructions } from "./saul-harness.js";

import {readLiveEvent, liveUsageSeconds, type LiveEvent} from "./voice-protocol.js";
type LiveVoice = "marin" | "quartz" | "vesper" | "stone";

export type LiveConnection = {
  send: (event: Record<string, unknown>) => boolean;
  disconnect: () => void;
};

export class LiveProviderError extends Error {
  constructor(readonly status: number, readonly uncertain = false) {
    super("The voice provider could not start the session.");
  }
}

export function liveSessionConfig(model: string, language: string,
  voice: LiveVoice = "marin") {
  return {
    model, store: false, delegation: {type: "client"},
    audio: {output: {voice}},
    instructions: "You are Saul, the witty accounting companion for a private UK LTD workspace. " +
      `Speak briefly and naturally, initially in ${language}; follow the user's language. ` +
      "Delegate every accounting question, company lookup, receipt or invoice request and change to the backend agent, including fictional examples and demo simulations. " +
      "Wait for verified backend results before stating workspace figures or claiming actions completed. Present fictional example figures returned by the backend as demo data. " +
      "Actual mutations support explicitly requested drafts and company updates only. Never claim an actual posting, approval, filing or payment. " +
      eventDemoInstructions + " Let the user speak first.",
    client: {data_channel: {
      // The frontend cannot inject verified results or alter prompts.
      allowed_client_events: ["session.close",
        "session.input_audio.mute", "session.input_audio.unmute"],
      allowed_server_events: [{type: "session.started"},
        {type: "session.closed"}, {type: "error"}],
    }},
  };
}

export async function createLiveSession(
  apiKey: string,
  sdp: string,
  model: string,
  language: string,
  voice: LiveVoice = "marin",
): Promise<{id: string; sdp: string; requestId: string | null}> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {"Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"},
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        session: liveSessionConfig(model, language, voice),
        transport: {type: "webrtc", sdp},
      }),
    });
  } catch {
    // Never retry session creation: an uncertain retry could create two calls.
    throw new LiveProviderError(502, true);
  }
  if (!response.ok) {
    throw new LiveProviderError(response.status,
      response.status >= 500);
  }
  let data: {
    session?: {id?: unknown}; transport?: {sdp?: unknown; type?: unknown};
  };
  try {
    data = await response.json();
  } catch {
    throw new LiveProviderError(502, true);
  }
  if (typeof data.session?.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(data.session.id) ||
    typeof data.transport?.sdp !== "string" ||
    data.transport.type !== "webrtc") throw new LiveProviderError(502, true);
  return {id: data.session.id, sdp: data.transport.sdp,
    requestId: response.headers.get("x-request-id")};
}

export async function attachLiveSession(
  apiKey: string,
  id: string,
  onEvent: (event: LiveEvent) => void,
  onLost: () => void,
): Promise<LiveConnection> {
  return new Promise((resolve, reject) => {
    let opened = false;
    const socket = new WebSocket(
      `wss://api.openai.com/v1/live/sessions/${encodeURIComponent(id)}/attach`,
      {headers: {Authorization: `Bearer ${apiKey}`},
        handshakeTimeout: 10000, maxPayload: 2 * 1024 * 1024},
    );
    socket.on("message", (raw) => {
      try {
        const event = readLiveEvent(JSON.parse(raw.toString()));
        if (event) onEvent(event);
      } catch {
        onLost();
      }
    });
    socket.on("open", () => {
      opened = true;
      resolve({
        send: (event) => {
          if (socket.readyState !== WebSocket.OPEN) return false;
          socket.send(JSON.stringify(event), (err) => {
            if (err) onLost();
          });
          return true;
        },
        disconnect: () => {
          socket.close();
        },
      });
    });
    socket.on("error", () => {
      if (!opened) reject(new Error("Voice control connection failed."));
      else onLost();
    });
    socket.on("close", () => {
      if (!opened) reject(new Error("Voice control connection closed."));
      else onLost();
    });
  });
}

// Used by the stale-call recovery job too. The trusted sideband can close a
// call even when the client or the HTTP controller no longer exists.
export async function closeLiveSession(
  apiKey: string,
  id: string,
): Promise<number | null> {
  let connection: LiveConnection | null = null;
  let finish: (seconds: number | null) => void = () => undefined;
  const result = new Promise<number | null>((resolve) => {
    finish = resolve;
  });
  const timeout = setTimeout(() => finish(null), 12000);
  try {
    connection = await attachLiveSession(apiKey, id, (event) => {
      if (event.type === "session.closed") finish(liveUsageSeconds(event));
    }, () => finish(null));
    connection.send({type: "session.close"});
    return await result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    connection?.disconnect();
  }
}

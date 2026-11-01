import { currentWorkspaceUser } from "../firebase";
import { voiceEventSchema, type VoiceEvent } from "../lib/voice";
import { observeCallAudio, type CallAudioLevels } from "./voice-audio";

export type CallEvent = VoiceEvent | { type: "ready" };
export type CallInput = {
  language: "English" | "Spanish";
  messages: { role: "user" | "assistant"; content: string }[];
};

// Validate each record before it reaches React. The stream may split UTF-8 or JSON
// at any byte, and a missing final event is a connection failure.
export async function readVoiceStream(response: Response, onEvent: (event: VoiceEvent) => void, signal: AbortSignal) {
  if (!response.body) throw Error("The voice stream was empty.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => { void reader.cancel(signal.reason).catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  let buffer = "", ended = false;
  function accept(line: string) {
    if (!line.trim()) return;
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw Error("The voice response was incomplete."); }
    const result = voiceEventSchema.safeParse(value);
    if (!result.success) throw Error("The voice response was incomplete.");
    if (result.data.type === "error") throw Error(result.data.message);
    if (result.data.type === "ended") ended = true;
    onEvent(result.data);
  }
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 256000) throw Error("The voice response was too large.");
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        accept(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
      }
      if (done) break;
    }
    accept(buffer);
    if (!ended) throw Error("Voice connection lost. Please call again.");
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function startVoiceCall(input: CallInput, onEvent: (event: CallEvent) => void,
  signal: AbortSignal, onControls: (mute: (muted: boolean) => void) => void,
  onLevels: (levels: CallAudioLevels) => void) {
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw Error("Voice calls need a browser with microphone support on HTTPS or localhost.");
  const token = await currentWorkspaceUser()?.getIdToken();
  if (!token) throw Error("Sign in to call Saul.");
  signal.throwIfAborted();
  const transport = new AbortController();
  const peer = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  const channel = peer.createDataChannel("oai-events");
  const spectrum = observeCallAudio(onLevels);
  let microphone: MediaStream | undefined;
  let fail!: (error: Error) => void;
  const lost = new Promise<never>((_, reject) => { fail = reject; });
  void lost.catch(() => undefined);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    fail(new DOMException("Call ended.", "AbortError"));
    transport.abort();
    try { if (channel.readyState === "open") channel.send(JSON.stringify({ type: "session.close" })); } catch { /* The trusted server closes a disconnected call. */ }
    microphone?.getTracks().forEach((track) => track.stop());
    spectrum.stop(); channel.close(); peer.close(); audio.pause(); audio.srcObject = null;
  };
  signal.addEventListener("abort", cleanup, { once: true });
  let startup: ReturnType<typeof setTimeout> | undefined;
  peer.onconnectionstatechange = () => {
    if (cleaned) return;
    if (peer.connectionState === "connected") { clearTimeout(startup); onEvent({ type: "ready" }); }
    if (["failed", "disconnected", "closed"].includes(peer.connectionState)) fail(Error("Voice connection lost. Please call again."));
  };
  channel.onmessage = (event) => {
    try { if (JSON.parse(event.data).type === "error") fail(Error("Voice connection lost. Please call again.")); }
    catch { fail(Error("The voice connection returned an invalid event.")); }
  };
  try {
    const permission = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    void permission.then((stream) => { if (cleaned) stream.getTracks().forEach((track) => track.stop()); }).catch(() => undefined);
    microphone = await Promise.race([permission, lost]);
    // A hang-up while the browser prompt is open must stop a late microphone.
    if (signal.aborted) { microphone.getTracks().forEach((track) => track.stop()); signal.throwIfAborted(); }
    spectrum.add(microphone, true);
    onControls((muted) => {
      if (cleaned) return;
      spectrum.mute(muted);
      microphone?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
      if (channel.readyState === "open") channel.send(JSON.stringify({ type: muted ? "session.input_audio.mute" : "session.input_audio.unmute" }));
    });
    microphone.getTracks().forEach((track) => peer.addTrack(track, microphone!));
    peer.ontrack = (event) => {
      if (cleaned) return;
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      spectrum.add(remote, false); audio.srcObject = remote;
      void audio.play().catch(() => fail(Error("Your browser could not play Saul’s audio. Please call again.")));
    };
    startup = setTimeout(() => { fail(Error("The call took too long to connect. Please try again.")); transport.abort(); }, 30000);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    signal.throwIfAborted();
    // Firebase Hosting cuts rewritten requests off at 60 seconds. Production
    // calls use the function directly so its trusted sideband can stay alive.
    const url = import.meta.env.DEV ? "/api/voice" : "https://europe-west2-rent-o-accountant.cloudfunctions.net/api/api/voice";
    const response = await Promise.race([lost, fetch(url, {
      method: "POST", signal: transport.signal,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, sdp: offer.sdp }),
    })]);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw Error(typeof body?.error === "string" ? body.error : "Saul could not start the call. Please try again.");
    }
    let applying = Promise.resolve();
    await Promise.race([lost, readVoiceStream(response, (event) => {
      if (event.type === "connected") {
        applying = peer.setRemoteDescription({ type: "answer", sdp: event.sdp });
        void applying.catch(() => fail(Error("The voice connection could not be established.")));
      }
      onEvent(event);
    }, transport.signal)]);
    await applying;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") throw Error("Microphone access is blocked. Enable it in your browser to call Saul.");
    throw error;
  } finally {
    clearTimeout(startup);
    signal.removeEventListener("abort", cleanup);
    cleanup();
  }
}

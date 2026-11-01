import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Mic, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import Saul from "./saul";
import AnimatedCaption from "./animated-caption";
import { startVoiceCall, type CallInput } from "../services/voice";
import { SILENT_CALL_LEVELS } from "../services/voice-audio";
import { mergeCallCaption, type CallCaption } from "../lib/voice";

export default function VoiceCall({ live, disabled, messages, onEnd }: {
  live: boolean; disabled: boolean; messages: CallInput["messages"];
  onEnd: (captions: CallCaption[]) => void;
}) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [captions, setCaptions] = useState<CallCaption[]>([]);
  const [levels, setLevels] = useState(SILENT_CALL_LEVELS);
  const abort = useRef<AbortController | null>(null);
  const mute = useRef<((value: boolean) => void) | null>(null);
  const mounted = useRef(true);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { if (!live) abort.current?.abort(); }, [live]);
  useEffect(() => {
    const hide = () => { if (document.hidden) abort.current?.abort(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!active || !ready) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active, ready]);
  async function start() {
    if (!live || disabled || abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    returnFocus.current = document.activeElement as HTMLElement | null;
    let transcript: CallCaption[] = [];
    setActive(true); setReady(false); setMuted(false); setWorking(false); setError(""); setSeconds(0); setCaptions([]); setLevels(SILENT_CALL_LEVELS);
    try {
      await startVoiceCall({ messages: messages.slice(-16), language: navigator.language.startsWith("es") ? "Spanish" : "English" }, (event) => {
        if (!mounted.current || controller.signal.aborted) return;
        if (event.type === "ready") setReady(true);
        if (event.type === "working") setWorking(true);
        if (event.type === "listening") setWorking(false);
        if (event.type === "transcript") { transcript = mergeCallCaption(transcript, event); setCaptions(transcript); }
      }, controller.signal, (control) => { mute.current = control; }, (value) => { if (mounted.current && !controller.signal.aborted) setLevels(value); });
    } catch (e) {
      if (!controller.signal.aborted && mounted.current) setError(e instanceof Error ? e.message : "Saul could not start the call. Please try again.");
    } finally {
      abort.current = null; mute.current = null;
      if (mounted.current) { setActive(false); setReady(false); setLevels(SILENT_CALL_LEVELS); onEnd(transcript); }
    }
  }
  const latestUser = captions.filter((c) => c.role === "user").at(-1);
  const latestAssistant = captions.filter((c) => c.role === "assistant").at(-1);
  const close = () => { if (active) abort.current?.abort(); else setError(""); };
  return <>
    <Button type="button" variant="ghost" size="icon" aria-label="Call Saul" title={live ? "Call Saul" : "Sign in to call Saul"}
      disabled={!live || disabled || active} onClick={() => void start()}><Phone size={18} /></Button>
    <Dialog open={active || !!error} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="voice-call" showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}>
        <DialogHeader className="voice-heading">
          <DialogTitle>Better call Saul.</DialogTitle>
          <DialogDescription>Saul’s office · voice call</DialogDescription>
        </DialogHeader>
        <p className="voice-status" role="status">{error ? "Call ended" : !ready ? "Connecting to Saul…" : working ? "Checking your books…" : muted ? "Microphone muted" : "I’m listening."}
          {ready && <span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>}</p>
        <div className="voice-scene" aria-hidden="true">
          <div className="voice-halo" style={{ "--voice-scale": 1 + Math.max(...levels.microphone) * 0.12 } as CSSProperties} />
          <Saul state="phone" className="voice-saul" />
          <div className="voice-bars">{levels.assistant.map((value, i) => <span key={i} style={{ height: `${4 + value * 34}px` }} />)}</div>
        </div>
        <div className="voice-captions" role="region" aria-label="Live captions" tabIndex={0}>
          <div aria-live="polite" aria-atomic="false">
            {latestUser && <p className="voice-user"><small>You</small><AnimatedCaption key={`user-${latestUser.startMs}`} text={latestUser.text} /></p>}
            {latestAssistant && <p className="voice-assistant"><small>Saul</small><AnimatedCaption key={`assistant-${latestAssistant.startMs}`} text={latestAssistant.text} /></p>}
            {!captions.length && !error && <p className="voice-placeholder">{ready ? "Go ahead. What are we looking at?" : "Picking up the phone…"}</p>}
            {error && <p role="alert" className="error">{error}</p>}
          </div>
        </div>
        <div className="voice-controls">
          {active && ready && <Button type="button" variant="outline" size="icon" aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={muted} onClick={() => { mute.current?.(!muted); setMuted(!muted); }}>{muted ? <MicOff /> : <Mic />}</Button>}
          <Button type="button" variant={active ? "destructive" : "secondary"} size="icon" aria-label={active ? "End call" : "Back to chat"} onClick={close}>
            {active ? <PhoneOff /> : <X />}
          </Button>
          {!!error && <Button type="button" variant="outline" onClick={() => void start()}>Try again</Button>}
        </div>
        <p className="voice-note">The conversation stays in this chat.</p>
      </DialogContent>
    </Dialog>
  </>;
}

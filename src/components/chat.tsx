import { useState, useRef, useEffect } from "react";
import { ArrowUp, X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import MessageContent from "./message-content";
import Saul from "./saul";
import VoiceCall from "./voice-call";
import { sendChat } from "../services/workspace";
import { fetchConversation, saveConversation } from "../services/conversation";
import { welcomeConversation, recentConversation, type ChatMessage } from "../lib/conversation";
import { money, type Receipt } from "../domain";
export default function Chat({
  live,
  items,
  onRefresh,
}: {
  live: boolean;
  items: Receipt[];
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<ChatMessage[]>(welcomeConversation),
    [loading, setLoading] = useState(true),
    [historyError, setHistoryError] = useState(false),
    [reload, setReload] = useState(0),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const session = useRef<AbortController | null>(null);
  const pendingSave = useRef(Promise.resolve());
  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    setLoading(true);
    setHistoryError(false);
    setError("");
    fetchConversation(live, controller.signal).then((saved) => {
      if (!controller.signal.aborted) setMessages(saved.length ? saved : welcomeConversation);
    }).catch((e: Error) => {
      if (!controller.signal.aborted) { setError(e.message); setHistoryError(true); }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [live, reload]);
  function persist(next: ChatMessage[]) {
    const signal = session.current?.signal;
    const saving = pendingSave.current.catch(() => {}).then(() => saveConversation(next, live, signal));
    pendingSave.current = saving;
    return saving;
  }
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(value: string) {
    if (!value.trim() || busy || loading || historyError) return;
    const next = [
      ...messages,
      { role: "user" as const, content: value.trim() },
    ];
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      await persist(next);
      let reply;
      if (live) {
        reply = await sendChat(next.slice(-16), session.current?.signal);
      } else {
        const vat = items
          .filter((r) => r.status === "posted")
          .reduce((n, r) => n + r.decision.reclaimPence, 0);
        reply = `This is the demo workspace. You have ${items.length} receipts and ${money(vat)} of recoverable VAT posted. ${items.filter((r) => r.status === "review").length} receipts are waiting for review. Open a receipt to see the reasoning. The live agent needs a configured backend.`;
      }
      const completed = recentConversation([...next, { role: "assistant", content: reply }]);
      if (session.current?.signal.aborted) return;
      setMessages(completed);
      await persist(completed);
      if (live) await onRefresh();
    } catch (e) {
      if (!session.current?.signal.aborted) setError((e as Error).message);
    } finally {
      if (!session.current?.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      {!open && (
        <Button
          className="saul-launcher"
          variant="ghost"
          aria-label="Open chat with Saul"
          onClick={() => setOpen(true)}
        >
          <Saul state="smoking" />
          <span className="online-dot" />
        </Button>
      )}
      {open && (
        <section className="chat-panel" aria-label="Chat with Saul">
          <header>
            <div>
              <span className="online-dot" />
              <strong>Saul’s office</strong>
              <small>
                {live
                  ? "gpt-6-luna · your accounting companion"
                  : "Offline conversation"}
              </small>
            </div>
            <VoiceCall live={live} disabled={busy || loading || historyError} messages={messages} onEnd={(captions) => {
              if (captions.length) {
                const next = recentConversation([...messages, ...captions.filter((c) => c.text.trim()).map((c) => ({ role: c.role, content: c.text }))]);
                setMessages(next);
                void persist(next).catch((e: Error) => { if (!session.current?.signal.aborted) setError(e.message); });
              }
              if (live) void onRefresh().catch((e: Error) => setError(e.message));
            }} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </header>
          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role}>
                <MessageContent content={m.content} />
              </div>
            ))}
            {busy && (
              <div className="message assistant">
                <Loader2 size={14} className="animate-spin" />
                Reading the fine print…
              </div>
            )}
            <Saul
              className="chat-saul"
              state={
                busy ? "thinking" : messages.length > 1 ? "approved" : "idle"
              }
            />
            <div ref={bottom} />
          </div>
          {loading && <p role="status">Opening your conversation…</p>}
          {!loading && !historyError && messages.length === 1 && (
            <div className="chat-suggestions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void send("What needs my attention?")}
              >
                What needs my attention?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void send("What VAT can I reclaim?")}
              >
                What VAT can I reclaim?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void send("Help me create an invoice")}
              >
                Create an invoice
              </Button>
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {historyError && <Button variant="outline" onClick={() => setReload((value) => value + 1)}>Retry conversation</Button>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <Label htmlFor="chat-input" className="sr-only">
              Message Saul
            </Label>
            <Input
              id="chat-input"
              value={text}
              maxLength={5000}
              disabled={busy || loading || historyError}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Saul anything about your books…"
            />
            <Button
              size="icon"
              type="submit"
              aria-label="Send message"
              disabled={busy || loading || historyError || !text.trim()}
            >
              <ArrowUp />
            </Button>
          </form>
          <footer>Helpful guidance. You approve the numbers.</footer>
        </section>
      )}
    </>
  );
}

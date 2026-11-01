import { useState, useRef, useEffect } from "react";
import { ArrowUp, SquarePen, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import Saul from "./saul";
import { sendChat } from "../services/workspace";
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
  const [messages, setMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
    >([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const empty = messages.length === 0;

  useEffect(() => {
    if (messages.length > 0) {
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (conversation.current) {
      conversation.current.scrollTop = 0;
    }
  }, [messages, busy]);

  async function send(value: string) {
    if (!value.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: value.trim() },
    ];
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      let reply;
      if (live) {
        reply = await sendChat(next.slice(-16));
        await onRefresh();
      } else {
        const vat = items
          .filter((r) => r.status === "posted")
          .reduce((n, r) => n + r.decision.reclaimPence, 0);
        reply = `This is the demo workspace. You have ${items.length} receipts and ${money(vat)} of recoverable VAT posted. ${items.filter((r) => r.status === "review").length} receipts are waiting for review. Open a receipt to see the reasoning. Sign in to chat with the live gpt-6-luna agent and create drafts.`;
      }
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(messages);
      setText(value.trim());
      setError((e as Error).message);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <section className="chat-page" aria-label="Chat with Saul">
      <header className="chat-header">
        <div>
          <strong>Saul’s office</strong>
          <small>
            <span className="online-dot" />
            {live ? "Your accounting companion" : "Demo conversation"}
          </small>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setMessages([]);
            setText("");
            setError("");
            input.current?.focus();
          }}
        >
          <SquarePen size={15} />
          New conversation
        </Button>
      </header>
      <div
        ref={conversation}
        className={"chat-messages" + (empty ? " is-empty" : "")}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {empty ? (
          <div className="chat-empty">
            <Saul className="chat-empty-saul" state="pacing" />
            <p className="eyebrow">BETTER CALL SAUL</p>
            <h1>Let’s talk business.</h1>
            <p>You handle the business. I’ll help with the fine print.</p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role}>
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="message assistant" role="status">
                <Loader2 size={14} className="animate-spin" />
                Reading the fine print…
              </div>
            )}
            <Saul className="chat-saul" state={busy ? "thinking" : "approved"} />
          </>
        )}
        <div ref={bottom} />
      </div>
      {empty && (
        <div className="chat-suggestions">
          {["What needs my attention?", "What VAT can I reclaim?"].map(
            (suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => void send(suggestion)}
              >
                {suggestion}
              </Button>
            ),
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <Label htmlFor="chat-input" className="sr-only">
          Message Saul
        </Label>
        <Textarea
          ref={input}
          id="chat-input"
          rows={1}
          value={text}
          maxLength={5000}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Ask Saul about your books…"
        />
        <Button
          size="icon"
          type="submit"
          aria-label="Send message"
          disabled={busy || !text.trim()}
        >
          <ArrowUp />
        </Button>
      </form>
      <footer>Helpful guidance. You approve the numbers.</footer>
    </section>
  );
}

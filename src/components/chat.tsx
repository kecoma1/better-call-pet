import { useState, useRef, useEffect } from "react";
import { ArrowUp, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<
      { role: "user" | "assistant"; content: string }[]
    >([
      {
        role: "assistant",
        content:
          "Hey, I’m Saul. You handle the business. I’ll help with the fine print. What are we looking at?",
      },
    ]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
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
          <span className="chat-invite">
            Better call Saul.
            <Sparkles size={13} />
          </span>
          <Saul />
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
                  : "Demo conversation"}
              </small>
            </div>
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
                {m.content}
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
          {messages.length === 1 && (
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
            </div>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
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
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Saul anything about your books…"
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
      )}
    </>
  );
}

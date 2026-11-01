import { useEffect, useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import type { ConversationsWorkspace } from "../hooks/use-conversations";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import ChatMessage from "./chat-message";
import Saul from "./saul";

export default function ChatThread({
  workspace: w,
  live,
  onOpenReceipt,
}: {
  workspace: ConversationsWorkspace;
  live: boolean;
  onOpenReceipt?: (id: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const messages = w.active?.messages ?? [];
  const empty = !messages.length && !w.pending && !w.loading;
  useEffect(() => {
    if (messages.length || w.pending)
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if (log.current) log.current.scrollTop = 0;
  }, [w.active, w.pending, w.busy, messages.length]);
  return (
    <>
      <div
        ref={log}
        className={"chat-messages" + (empty ? " is-empty" : "")}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {empty && (
          <div className="chat-empty-state">
            <Saul state="pacing" className="chat-empty-saul" />
            <p className="eyebrow">BETTER CALL SAUL</p>
            <h1>Let’s talk books.</h1>
            <p>You handle the business. I’ll help with the fine print.</p>
          </div>
        )}
        {messages.map((message, index) => (
          <ChatMessage
            key={`${w.active!.id}-${index}`}
            message={message}
            animate={index === w.animatedMessage}
            demo={!live}
            onOpenReceipt={onOpenReceipt}
          />
        ))}
        {w.pending && (
          <ChatMessage message={{ role: "user", content: w.pending }} />
        )}
        {(w.busy || w.loading) && (
          <p className="chat-status" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {w.busy ? "Reading the fine print…" : "Opening conversations…"}
          </p>
        )}
        <div ref={bottom} />
      </div>
      {empty && !w.busy && (
        <div className="chat-suggestions">
          {["What needs my attention?", "What VAT can I reclaim?"].map(
            (suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                disabled={w.loading}
                onClick={() => void w.send(suggestion)}
              >
                {suggestion}
              </Button>
            ),
          )}
        </div>
      )}
      {w.error && (
        <p className="error" role="alert">
          {w.error}
        </p>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void w.send(w.text);
        }}
      >
        <Label htmlFor="chat-input" className="sr-only">
          Message Saul
        </Label>
        <Textarea
          id="chat-input"
          rows={1}
          value={w.text}
          maxLength={5000}
          disabled={w.busy || w.loading}
          onChange={(e) => w.setText(e.target.value)}
          placeholder="Ask Saul about your books…"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void w.send(w.text);
            }
          }}
        />
        <Button
          size="icon"
          type="submit"
          aria-label="Send message"
          disabled={w.busy || w.loading || !w.text.trim()}
        >
          <ArrowUp />
        </Button>
      </form>
      <footer>
        {live
          ? "Helpful guidance. You approve the numbers."
          : "Demo conversation · example data and topic rules"}
      </footer>
    </>
  );
}

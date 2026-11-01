import { useEffect, useRef } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import type { ConversationsWorkspace } from "../hooks/use-conversations";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import ChatMessage from "./chat-message";
import Saul from "./saul";

const welcome = {
  role: "assistant" as const,
  content:
    "Hey, I’m Saul. You handle the business. I’ll help with the fine print. What are we looking at?",
};
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
  const messages = w.active?.messages ?? [];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [w.active, w.pending, w.busy]);
  return (
    <>
      <div
        className="chat-messages"
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!messages.length && !w.loading && <ChatMessage message={welcome} />}
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
        <Saul
          className="chat-saul"
          state={w.busy ? "thinking" : messages.length ? "approved" : "idle"}
        />
        <div ref={bottom} />
      </div>
      {!messages.length && !w.busy && (
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
        onSubmit={(e) => {
          e.preventDefault();
          void w.send(w.text);
        }}
      >
        <Label htmlFor="chat-input" className="sr-only">
          Message Saul
        </Label>
        <Input
          id="chat-input"
          value={w.text}
          maxLength={5000}
          disabled={w.busy || w.loading}
          onChange={(e) => w.setText(e.target.value)}
          placeholder="Ask Saul about your books…"
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

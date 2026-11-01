import { useState } from "react";
import { Maximize2, Plus, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import Saul from "./saul";
import ChatThread from "./chat-thread";
import ChatPage from "../pages/chat";
import { useConversations } from "../hooks/use-conversations";
import type { Receipt } from "../domain";

export default function Chat({
  live,
  items,
  onRefresh,
  view = "floating",
  onExpand,
  onOpenReceipt,
}: {
  live: boolean;
  items: Receipt[];
  onRefresh: () => Promise<void>;
  view?: "floating" | "page";
  onExpand?: () => void;
  onOpenReceipt?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const workspace = useConversations(live, items, onRefresh);
  if (view === "page")
    return (
      <ChatPage
        workspace={workspace}
        live={live}
        onOpenReceipt={onOpenReceipt}
      />
    );
  if (!open)
    return (
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
        <Saul state="smoking" />
        <span className="online-dot" />
      </Button>
    );
  return (
    <section className="chat-panel" aria-label="Chat with Saul">
      <header>
        <div>
          <span className="online-dot" />
          <strong>Saul’s office</strong>
          <small>
            {live ? "Your accounting companion" : "Demo conversation"}
          </small>
          {workspace.active && (
            <Badge variant="outline">{workspace.active.topic}</Badge>
          )}
        </div>
        <div className="chat-header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New conversation"
            disabled={workspace.busy}
            onClick={workspace.newConversation}
          >
            <Plus />
          </Button>
          {onExpand && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open all conversations"
              onClick={onExpand}
            >
              <Maximize2 />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
      </header>
      <ChatThread
        workspace={workspace}
        live={live}
        onOpenReceipt={onOpenReceipt}
      />
    </section>
  );
}

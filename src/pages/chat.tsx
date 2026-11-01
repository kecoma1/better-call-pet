import { useEffect, useState } from "react";
import {
  ArrowLeft,
  LogIn,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
} from "lucide-react";
import { conversationTopics, type ConversationTopic } from "../domain";
import type { ConversationsWorkspace } from "../hooks/use-conversations";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import DemoVideoButton from "../components/demo-video-button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import ChatThread from "../components/chat-thread";

export default function ChatPage({
  workspace: w,
  live,
  onOpenReceipt,
  onNavigate,
  onSignIn,
}: {
  workspace: ConversationsWorkspace;
  live: boolean;
  onOpenReceipt?: (id: string) => void;
  onNavigate?: (page: string) => void;
  onSignIn?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState<ConversationTopic | "All">("All");
  const [mobile, setMobile] = useState(() => window.innerWidth <= 760);
  const [historyOpen, setHistoryOpen] = useState(() => window.innerWidth > 760);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const change = (event: MediaQueryListEvent) => {
      setMobile(event.matches);
      setHistoryOpen(!event.matches);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const filtered = w.conversations.filter(
    (c) =>
      (topic === "All" || c.topic === topic) &&
      `${c.title} ${c.preview}`.toLowerCase().includes(search.toLowerCase()),
  );
  const history = (
    <aside className="conversation-sidebar" aria-label="Conversations">
      <a className="chat-brand" href="/" aria-label="Better Call Pet home">
        <img src="/logo.webp" alt="" />
        <span>
          better call{" "}
          <strong>
            pet<span>✳</span>
          </strong>
        </span>
      </a>
      <div className="conversation-sidebar-heading">
        <strong>Conversations</strong>
        <Badge variant="secondary">{w.conversations.length}</Badge>
      </div>
      <Button
        variant="secondary"
        className="conversation-new"
        onClick={() => {
          w.newConversation();
          if (mobile) setHistoryOpen(false);
        }}
        disabled={w.busy}
      >
        <SquarePen size={16} />
        New conversation
      </Button>
      <div className="search-box">
        <Search size={14} />
        <Label className="sr-only" htmlFor="conversation-search">
          Search conversations
        </Label>
        <Input
          id="conversation-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a conversation…"
        />
      </div>
      <div
        className="conversation-filters"
        role="group"
        aria-label="Filter conversations by topic"
      >
        {(["All", ...conversationTopics] as const).map((value) => (
          <Button
            key={value}
            variant={topic === value ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={topic === value}
            onClick={() => setTopic(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <nav className="conversation-list" aria-label="Conversation history">
        {filtered.map((c) => (
          <Button
            variant="ghost"
            key={c.id}
            className="conversation-item"
            aria-current={w.active?.id === c.id ? "true" : undefined}
            disabled={w.busy || w.loading}
            onClick={() => {
              void w.openConversation(c.id);
              if (mobile) setHistoryOpen(false);
            }}
          >
            <span className="conversation-item-top">
              <MessageCircle size={14} />
              <Badge variant="outline">{c.topic}</Badge>
            </span>
            <strong>{c.title}</strong>
            <span className="conversation-preview">{c.preview}</span>
            <time dateTime={c.updatedAt}>
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                timeZone: "Europe/London",
              }).format(new Date(c.updatedAt))}
            </time>
          </Button>
        ))}
        {!filtered.length && !w.loading && (
          <p className="conversation-empty">
            {w.conversations.length
              ? "No conversations match your search."
              : "Your first conversation starts here. Ask Saul a question."}
          </p>
        )}
      </nav>
      <div className="conversation-sidebar-footer">
        {live && (
          <Button
            variant="ghost"
            size="sm"
            disabled={w.loading || w.busy}
            onClick={w.reload}
          >
            Refresh conversations
          </Button>
        )}
        {!live && onSignIn && (
          <Button variant="ghost" onClick={onSignIn}>
            <LogIn size={16} />
            Sign in
          </Button>
        )}
        <Button variant="ghost" onClick={() => onNavigate?.("Overview")}>
          <ArrowLeft size={16} />
          Open workspace
        </Button>
      </div>
    </aside>
  );
  return (
    <div
      className={"chat-page" + (historyOpen && !mobile ? " history-open" : "")}
    >
      {mobile ? (
        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="chat-history-sheet">
            <SheetHeader className="sr-only">
              <SheetTitle>Conversation history</SheetTitle>
              <SheetDescription>
                Find and open your conversations with Saul.
              </SheetDescription>
            </SheetHeader>
            {history}
          </SheetContent>
        </Sheet>
      ) : historyOpen ? (
        history
      ) : null}
      <section className="chat-page-thread" aria-label="Chat with Saul">
        <header>
          <div className="chat-thread-heading">
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                historyOpen ? "Hide conversations" : "Show conversations"
              }
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              {historyOpen ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </Button>
            <div>
              <strong>{w.active?.title ?? "Saul’s office"}</strong>
              <small>
                {live ? "Your accounting companion" : "Demo conversation"}
              </small>
            </div>
            {w.active && <Badge variant="outline">{w.active.topic}</Badge>}
          </div>
          <DemoVideoButton />
        </header>
        <ChatThread workspace={w} live={live} onOpenReceipt={onOpenReceipt} />
      </section>
    </div>
  );
}

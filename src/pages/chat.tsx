import { useState } from "react";
import { MessageCircle, Plus, Search } from "lucide-react";
import { conversationTopics, type ConversationTopic } from "../domain";
import type { ConversationsWorkspace } from "../hooks/use-conversations";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import ChatThread from "../components/chat-thread";

export default function ChatPage({
  workspace: w,
  live,
  onOpenReceipt,
}: {
  workspace: ConversationsWorkspace;
  live: boolean;
  onOpenReceipt?: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState<ConversationTopic | "All">("All");
  const filtered = w.conversations.filter(
    (c) =>
      (topic === "All" || c.topic === topic) &&
      `${c.title} ${c.preview}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="chat-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p>
          <h1>
            Let’s talk books<span>.</span>
          </h1>
          <p>Your conversations, with the fine print in good hands.</p>
        </div>
        <Button onClick={w.newConversation} disabled={w.busy}>
          <Plus size={16} />
          New conversation
        </Button>
      </div>
      <Card className="chat-workspace">
        <CardContent>
          <aside className="conversation-sidebar" aria-label="Conversations">
            <div className="conversation-sidebar-heading">
              <strong>Conversations</strong>
              <Badge variant="secondary">{w.conversations.length}</Badge>
            </div>
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
            <nav
              className="conversation-list"
              aria-label="Conversation history"
            >
              {filtered.map((c) => (
                <Button
                  variant="ghost"
                  key={c.id}
                  className="conversation-item"
                  aria-current={w.active?.id === c.id ? "true" : undefined}
                  disabled={w.busy || w.loading}
                  onClick={() => void w.openConversation(c.id)}
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
          </aside>
          <section className="chat-page-thread" aria-label="Chat with Saul">
            <header>
              <div>
                <strong>{w.active?.title ?? "Saul’s office"}</strong>
                <small>
                  {live ? "Your accounting companion" : "Demo conversation"}
                </small>
              </div>
              {w.active && <Badge variant="outline">{w.active.topic}</Badge>}
            </header>
            <ChatThread
              workspace={w}
              live={live}
              onOpenReceipt={onOpenReceipt}
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

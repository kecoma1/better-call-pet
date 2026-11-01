import { useEffect, useRef, useState } from "react";
import type {
  ChatRun,
  Conversation,
  ConversationSummary,
  Receipt,
} from "../domain";
import {
  conversationSchema,
  fetchConversation,
  fetchConversations,
  sendConversationMessage,
} from "../services/chat";
import { demoConversation } from "../lib/demo-chat";
import { z } from "zod";
import { watchChatRun } from "../services/chat-events";

function storedDemo(): Conversation[] {
  try {
    return z
      .array(conversationSchema)
      .parse(JSON.parse(localStorage.getItem("bcp-demo-chats-v1") || "[]"));
  } catch {
    return [];
  }
}
export function useConversations(
  live: boolean,
  items: Receipt[],
  onRefresh: () => Promise<void>,
) {
  const [demo, setDemo] = useState<Conversation[]>(() =>
    live ? [] : storedDemo(),
  );
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(demo);
  const [active, setActive] = useState<Conversation | null>(null);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState("");
  const [pending, setPending] = useState("");
  const [progress, setProgress] = useState<ChatRun | null>(null);
  const [progressError, setProgressError] = useState("");
  const subscription = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [animatedMessage, setAnimatedMessage] = useState(-1);
  const operation = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const retry = useRef<{ id: string; text: string; requestId: string } | null>(
    null,
  );
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (animatedMessage < 0) return;
    const timer = setTimeout(() => setAnimatedMessage(-1), 1600);
    return () => clearTimeout(timer);
  }, [animatedMessage, active]);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    setLoading(true);
    fetchConversations(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setConversations(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [live, reload]);
  useEffect(
    () => () => {
      operation.current?.abort();
      subscription.current?.();
      subscription.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!live)
      try {
        localStorage.setItem("bcp-demo-chats-v1", JSON.stringify(demo));
      } catch {}
  }, [demo, live]);
  function newConversation() {
    if (sending.current) return;
    operation.current?.abort();
    setLoading(false);
    setActive(null);
    setProgress(null);
    setProgressError("");
    setDraftId(crypto.randomUUID());
    setText("");
    setError("");
    setAnimatedMessage(-1);
    retry.current = null;
  }
  async function openConversation(id: string) {
    if (sending.current) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    setLoading(true);
    setError("");
    try {
      const conversation = live
        ? await fetchConversation(id, controller.signal)
        : demo.find((c) => c.id === id);
      if (!conversation) throw Error("Conversation not found.");
      if (!controller.signal.aborted) {
        setActive(conversation);
        setText("");
        setAnimatedMessage(-1);
        retry.current = null;
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  async function send(value: string) {
    const message = value.trim();
    if (!message || message.length > 5000 || sending.current || loading) return;
    const id = active?.id ?? draftId;
    const request =
      retry.current?.id === id && retry.current.text === message
        ? retry.current
        : { id, text: message, requestId: crypto.randomUUID() };
    retry.current = request;
    sending.current = true;
    setBusy(true);
    setPending(message);
    setProgress(null);
    setProgressError("");
    setError("");
    setText("");
    const controller = new AbortController();
    operation.current = controller;
    subscription.current?.();
    if (live) {
      try {
        subscription.current = watchChatRun(
          id,
          request.requestId,
          (run) => {
            if (!controller.signal.aborted) setProgress(run);
          },
          (error) => {
            if (!controller.signal.aborted) setProgressError(error.message);
          },
        );
      } catch {
        setProgressError(
          "Live updates are unavailable. Your reply will still appear when it finishes.",
        );
      }
    }
    try {
      const saved = live
        ? await sendConversationMessage(
            id,
            message,
            request.requestId,
            controller.signal,
          )
        : demoConversation(active, id, message, items);
      if (controller.signal.aborted) return;
      subscription.current?.();
      subscription.current = null;
      setPending("");
      setActive(saved);
      setProgress(null);
      setProgressError("");
      setAnimatedMessage(live ? -1 : saved.messages.length - 1);
      retry.current = null;
      setConversations((all) =>
        [saved, ...all.filter((c) => c.id !== id)].slice(0, 100),
      );
      if (!live)
        setDemo((all) =>
          [saved, ...all.filter((c) => c.id !== id)].slice(0, 100),
        );
      else
        try {
          await onRefresh();
        } catch {
          if (!controller.signal.aborted)
            setError(
              "Reply saved. Workspace data could not refresh; reopen the workspace to update it.",
            );
        }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError((e as Error).message);
        setText(message);
      }
    } finally {
      subscription.current?.();
      subscription.current = null;
      sending.current = false;
      if (!controller.signal.aborted) {
        setBusy(false);
        setPending("");
      }
    }
  }
  return {
    conversations,
    active,
    text,
    setText,
    pending,
    progress,
    progressError,
    busy,
    loading,
    error,
    animatedMessage,
    newConversation,
    openConversation,
    send,
    reload: () => {
      setError("");
      setReload((r) => r + 1);
    },
  };
}
export type ConversationsWorkspace = ReturnType<typeof useConversations>;

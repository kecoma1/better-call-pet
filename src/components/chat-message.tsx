import type { CSSProperties } from "react";
import type { ChatMessage as Message } from "../domain";
import ChatToolCards from "./chat-tool-cards";

export default function ChatMessage({
  message,
  animate = false,
  demo = false,
  onOpenReceipt,
}: {
  message: Message;
  animate?: boolean;
  demo?: boolean;
  onOpenReceipt?: (id: string) => void;
}) {
  const tokens = message.content.split(/(\s+)/);
  const wordInterval = Math.min(
    24,
    1400 / Math.max(1, Math.ceil(tokens.length / 2)),
  );
  return (
    <article
      className={"message " + message.role}
      aria-label={
        message.role === "assistant" ? "Saul’s reply" : "Your message"
      }
    >
      {message.tools?.length ? (
        <ChatToolCards
          tools={message.tools}
          demo={demo}
          onOpenReceipt={onOpenReceipt}
        />
      ) : null}
      <p>
        {message.role === "assistant" ? (
          <>
            <span className="sr-only">{message.content}</span>
            <span aria-hidden="true">
              {tokens.map((word, index) =>
                /^\s+$/.test(word) ? (
                  word
                ) : (
                  <span
                    key={index}
                    className={animate ? "chat-word" : undefined}
                    style={
                      {
                        "--word-delay": `${Math.floor(index / 2) * wordInterval}ms`,
                      } as CSSProperties
                    }
                  >
                    {word}
                  </span>
                ),
              )}
            </span>
          </>
        ) : (
          message.content
        )}
      </p>
    </article>
  );
}

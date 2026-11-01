import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage as Message } from "../domain";
import ChatToolCards from "./chat-tool-cards";
import ChatActivity from "./chat-activity";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const components: Components = {
  table: ({ children }) => <Table>{children}</Table>,
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children, style }) => <TableHead style={style}>{children}</TableHead>,
  td: ({ children, style }) => <TableCell style={style}>{children}</TableCell>,
};

type MarkdownNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownNode[];
};

function revealWords({ interval }: { interval: number }) {
  return (tree: MarkdownNode) => {
    let index = 0;
    function walk(node: MarkdownNode) {
      if (!node.children || node.tagName === "code" || node.tagName === "pre")
        return;
      node.children = node.children.flatMap((child): MarkdownNode[] => {
        if (child.type !== "text" || !child.value) {
          walk(child);
          return [child];
        }
        return child.value
          .split(/(\s+)/)
          .filter(Boolean)
          .map((word) => {
            if (/^\s+$/.test(word)) return { type: "text", value: word };
            return {
              type: "element",
              tagName: "span",
              properties: {
                className: ["chat-word"],
                style: `--word-delay: ${index++ * interval}ms`,
              },
              children: [{ type: "text", value: word }],
            };
          });
      });
    }
    walk(tree);
  };
}

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
  const interval = Math.min(
    24,
    1400 / Math.max(1, message.content.trim().split(/\s+/).length),
  );
  return (
    <article
      className={"message " + message.role}
      aria-label={
        message.role === "assistant" ? "Saul’s reply" : "Your message"
      }
    >
      {message.activity?.length ? (
        <ChatActivity events={message.activity} />
      ) : null}
      {message.tools?.length ? (
        <ChatToolCards
          tools={message.tools}
          demo={demo}
          onOpenReceipt={onOpenReceipt}
        />
      ) : null}
      <div className="chat-markdown">
        <Markdown
          components={components}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={
            animate && message.role === "assistant"
              ? [[revealWords, { interval }]]
              : []
          }
        >
          {message.content}
        </Markdown>
      </div>
    </article>
  );
}

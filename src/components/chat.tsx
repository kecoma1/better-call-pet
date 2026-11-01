import ChatPage from "../pages/chat";
import { useConversations } from "../hooks/use-conversations";
import type { Receipt } from "../domain";

export default function Chat({
  live,
  items,
  onRefresh,
  active = true,
  onOpenReceipt,
}: {
  live: boolean;
  items: Receipt[];
  onRefresh: () => Promise<void>;
  active?: boolean;
  onOpenReceipt?: (id: string) => void;
}) {
  const workspace = useConversations(live, items, onRefresh);
  if (!active) return null;
  return (
    <ChatPage
      workspace={workspace}
      live={live}
      onOpenReceipt={onOpenReceipt}
    />
  );
}

import { Check, Loader2, X } from "lucide-react";
import type { ChatEvent } from "../domain";

const tools = {
  list_receipts: "Listing receipts",
  get_company: "Checking company details",
  create_receipt: "Creating receipt draft",
  save_company: "Saving company details",
};
const completed = {
  list_receipts: "Receipts listed",
  get_company: "Company details checked",
  create_receipt: "Receipt draft created",
  save_company: "Company details saved",
};
export default function ChatActivity({ events }: { events: ChatEvent[] }) {
  if (!events.length) return null;
  const last = events.at(-1)!;
  const finished = last.kind === "completed";
  const failed = last.kind === "failed";
  return (
    <details className="chat-activity-panel" open={!finished}>
      <summary>
        {finished ? "Activity" : failed ? "Activity failed" : "Working…"}
      </summary>
      <ol className="chat-activity" aria-label="Agent activity">
        {events.slice(-12).map((event, index, visible) => {
          const failed =
            event.kind === "failed" || event.kind === "tool_failed";
          const working =
            index === visible.length - 1 &&
            ["classifying", "responding", "tool_started"].includes(event.kind);
          const Icon = failed ? X : working ? Loader2 : Check;
          let label: string;
          switch (event.kind) {
            case "classifying":
              label = "Classifying your question";
              break;
            case "classified":
              label = event.topic
                ? `Topic: ${event.topic}`
                : "Question classified";
              break;
            case "tool_started":
              label = event.tool ? tools[event.tool] : "Running a tool";
              break;
            case "tool_completed":
              label = event.tool ? completed[event.tool] : "Tool completed";
              break;
            case "tool_failed":
              label = "Tool could not finish";
              break;
            case "responding":
              label = "Writing reply";
              break;
            case "completed":
              label = "Reply saved";
              break;
            case "failed":
              label = "Reply could not finish";
              break;
          }
          return (
            <li key={event.sequence}>
              <Icon
                size={12}
                className={working ? "animate-spin" : undefined}
                aria-hidden="true"
              />
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

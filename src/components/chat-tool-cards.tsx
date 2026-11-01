import { useState } from "react";
import { ArrowUpRight, Check, Wrench } from "lucide-react";
import { money, type ChatToolResult } from "../domain";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

const labels = {
  list_receipts: "Receipts listed",
  get_company: "Company checked",
  create_receipt: "Draft created",
  save_company: "Company saved",
};
export default function ChatToolCards({
  tools,
  demo,
  onOpenReceipt,
}: {
  tools: ChatToolResult[];
  demo: boolean;
  onOpenReceipt?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="chat-tool-results">
      <div
        className="chat-tool-pills"
        aria-label={demo ? "Demo tool examples" : "Tools used"}
      >
        {tools.map((tool, index) => (
          <Badge key={index} variant="outline">
            <Wrench size={11} aria-hidden="true" />
            {demo ? "Demo · " : ""}
            {labels[tool.name]}
            <Check size={11} aria-hidden="true" />
          </Badge>
        ))}
      </div>
      {tools.map((tool, index) => (
        <div key={index}>
          {tool.receipts && (
            <Card className="chat-result-card">
              <CardContent>
                <strong>
                  {tool.name === "create_receipt"
                    ? "Receipt draft · awaiting review"
                    : `Receipts · ${tool.receiptCount ?? tool.receipts.length}`}
                </strong>
                {tool.receiptCount &&
                tool.receiptCount > tool.receipts.length ? (
                  <p>
                    Showing the first {tool.receipts.length} receipts. Open
                    Receipts to see all records.
                  </p>
                ) : null}
                {!tool.receipts.length ? (
                  <p>No receipts found.</p>
                ) : (
                  <ul>
                    {(expanded ? tool.receipts : tool.receipts.slice(0, 5)).map(
                      (receipt) => (
                        <li key={receipt.id}>
                          <div>
                            <strong>{receipt.vendor}</strong>
                            <small>
                              {receipt.status === "posted"
                                ? "Posted to books"
                                : "Awaiting review"}
                            </small>
                          </div>
                          <span>
                            {money(receipt.netPence + receipt.vatPence)}
                          </span>
                          {onOpenReceipt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={"Open receipt " + receipt.vendor}
                              onClick={() => onOpenReceipt(receipt.id)}
                            >
                              <ArrowUpRight size={14} />
                            </Button>
                          )}
                        </li>
                      ),
                    )}
                  </ul>
                )}
                {tool.receipts.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded
                      ? "Show less"
                      : `Show ${tool.receipts.length - 5} more receipts`}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {tool.company && (
            <Card className="chat-result-card">
              <CardContent>
                <strong>{tool.company.name}</strong>
                <dl>
                  <div>
                    <dt>VAT registration</dt>
                    <dd>
                      {tool.company.vatRegistered
                        ? "Registered"
                        : "Not registered"}
                    </dd>
                  </div>
                  <div>
                    <dt>Year end</dt>
                    <dd>{tool.company.yearEnd}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </div>
  );
}

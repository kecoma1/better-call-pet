import { useId, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Wrench } from "lucide-react";
import { money, type ChatToolResult } from "../domain";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";

const labels = {
  list_receipts: "Receipts listed",
  get_company: "Company checked",
  create_receipt: "Draft created",
  save_company: "Company saved",
  list_invoices: "Invoices listed",
  create_invoice: "Invoice draft created",
  get_invoice_download: "Invoice links ready",
  download_invoice: "Invoice PDF ready",
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
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const companyId = useId();
  return (
    <div className="chat-tool-results">
      <div
        className="chat-tool-pills"
        aria-label={demo ? "Demo tool examples" : "Tools used"}
      >
        {tools.map((tool, index) => {
          const label = (
            <>
              <Wrench size={11} aria-hidden="true" />
              {demo ? "Demo · " : ""}
              {labels[tool.name]}
              <Check size={11} aria-hidden="true" />
            </>
          );
          return tool.name === "get_company" && tool.company ? (
            <Button
              key={index}
              type="button"
              variant="outline"
              size="xs"
              className="h-auto rounded-full px-2 py-0.5 text-[9px] font-normal text-muted-foreground"
              aria-expanded={expandedCompany === index}
              aria-controls={`${companyId}-${index}`}
              onClick={() =>
                setExpandedCompany(expandedCompany === index ? null : index)
              }
            >
              {label}
              <ChevronDown
                size={11}
                aria-hidden="true"
                className={expandedCompany === index ? "rotate-180" : undefined}
              />
            </Button>
          ) : (
            <Badge key={index} variant="outline">
              {label}
            </Badge>
          );
        })}
      </div>
      {tools.map((tool, index) => (
        <div key={index}>
          {(tool.invoices || tool.download) && (
            <Card className="chat-result-card">
              <CardContent>
                <strong>{tool.invoices ? `Invoice drafts · ${tool.invoiceCount ?? tool.invoices.length}` : "Invoice PDF"}</strong>
                {tool.invoices && (!tool.invoices.length ? <p>No invoice drafts found.</p> : (
                  <ul>{tool.invoices.map((invoice) => (
                    <li key={invoice.id}><div><strong>{invoice.number}</strong><small>{invoice.customerName} · Draft</small></div><span>{money(invoice.totalPence)}</span></li>
                  ))}</ul>
                ))}
                {tool.download && <p><a href={tool.download.publicUrl} target="_blank" rel="noopener noreferrer">View invoice</a>{" · "}<a href={tool.download.url} target="_blank" rel="noopener noreferrer">Download PDF</a></p>}
              </CardContent>
            </Card>
          )}
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
          {tool.company &&
            (tool.name !== "get_company" || expandedCompany === index) && (
              <Card className="chat-result-card" id={`${companyId}-${index}`}>
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

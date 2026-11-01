import { FileText, ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import VerdictBadge from "./verdict-badge";
import { money, type Receipt } from "../domain";
export default function ReceiptTable({
  items,
  onSelect,
}: {
  items: Receipt[];
  onSelect: (r: Receipt) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>VAT decision</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length ? (
          items.map((r) => (
            <TableRow
              key={r.id}
              className="detail-row"
              tabIndex={0}
              aria-label={"View expense details for " + r.vendor}
              aria-haspopup="dialog"
              onClick={(event) => {
                event.currentTarget.focus();
                onSelect(r);
              }}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onSelect(r);
                }
              }}
            >
              <TableCell>
                <div className="vendor">
                  <span className="vendor-icon">
                    <FileText size={17} />
                  </span>
                  <span>
                    <strong>{r.vendor}</strong>
                    <small>{r.category}</small>
                  </span>
                </div>
              </TableCell>
              <TableCell className="muted nowrap">
                {new Date(r.date + "T12:00:00Z").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </TableCell>
              <TableCell className="amount">
                {money(r.netPence + r.vatPence)}
              </TableCell>
              <TableCell>
                <VerdictBadge verdict={r.decision.verdict} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {r.status === "posted" ? "Posted" : "To review"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={"Review " + r.vendor}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(r);
                  }}
                >
                  <ArrowUpRight size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={6} className="empty">
              Your next receipt starts here. Add one to get your books moving.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

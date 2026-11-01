import { Download, BookOpenCheck } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { journal, money, type Receipt } from "../domain";
export default function Books({ items }: { items: Receipt[] }) {
  const posted = items.filter((r) => r.status === "posted");
  const lines = posted.flatMap((r) =>
    journal(r).map((l) => ({ ...l, id: r.id, date: r.date, vendor: r.vendor })),
  );
  const debit = lines.reduce((n, l) => n + l.debit, 0),
    credit = lines.reduce((n, l) => n + l.credit, 0);
  function download() {
    const rows = [
      ["Date", "Supplier", "Account", "Debit GBP", "Credit GBP"],
      ...lines.map((l) => [
        l.date,
        l.vendor,
        l.account,
        (l.debit / 100).toFixed(2),
        (l.credit / 100).toFixed(2),
      ]),
    ];
    const safe = (v: string) =>
      '"' + (/^[=+@-]/.test(v) ? "'" : "") + v.replaceAll('"', '""') + '"';
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(safe).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = "better-call-pet-ledger.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE SOURCE OF TRUTH</p>
          <h1>
            The books<span>.</span>
          </h1>
          <p>Approved receipts become balanced double-entry journals.</p>
        </div>
        <Button variant="outline" onClick={download}>
          <Download size={16} />
          Export ledger
        </Button>
      </div>
      <div className="stat-grid three">
        {[
          ["Total debits", money(debit)],
          ["Total credits", money(credit)],
          ["Difference", money(debit - credit)],
        ].map(([l, v]) => (
          <Card key={l}>
            <CardContent>
              <p className="muted">{l}</p>
              <strong className="big-number">{v}</strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <div className="section-heading">
            <h3>
              <BookOpenCheck size={18} />
              General ledger
            </h3>
            <Badge variant="outline">
              {debit === credit ? "Balanced" : "Check balance"}
            </Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / supplier</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Debit</TableHead>
                <TableHead>Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {l.date}
                    <small className="block muted">{l.vendor}</small>
                  </TableCell>
                  <TableCell>{l.account}</TableCell>
                  <TableCell>{l.debit ? money(l.debit) : "—"}</TableCell>
                  <TableCell>{l.credit ? money(l.credit) : "—"}</TableCell>
                </TableRow>
              ))}
              {!lines.length && (
                <TableRow>
                  <TableCell colSpan={4} className="empty">
                    Approve a receipt to create your first journal.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="hint">
            Purchases are credited to trade creditors. Bank reconciliation and
            payment matching are the next milestone.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

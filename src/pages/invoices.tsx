import { useEffect, useRef, useState } from "react";
import { Download, Plus, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../components/ui/table";
import InvoiceDialog from "../components/invoice-dialog";
import {
  money,
  type Company,
  type Invoice,
  type InvoiceDownload,
  type InvoiceInput,
} from "../domain";
import { getInvoiceDownload } from "../services/invoices";

export default function Invoices({
  items,
  company,
  live,
  onCreate,
}: {
  items: Invoice[];
  company: Company;
  live: boolean;
  onCreate: (input: InvoiceInput) => Promise<Invoice>;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const [download, setDownload] = useState<
    (InvoiceDownload & { number: string }) | null
  >(null);
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(
    () => () => {
      if (download?.url.startsWith("blob:")) URL.revokeObjectURL(download.url);
    },
    [download],
  );
  const filtered = items.filter((i) =>
    (i.number + " " + i.customerName)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function prepare(invoice: Invoice) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(invoice.id);
    setError("");
    setDownload(null);
    try {
      const result = await getInvoiceDownload(invoice, live, controller.signal);
      if (!controller.signal.aborted)
        setDownload({ ...result, number: invoice.number });
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORK, ON PAPER</p>
          <h1>
            Invoices<span>.</span>
          </h1>
          <p>Create a draft invoice and download a PDF for your records.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          Create invoice
        </Button>
      </div>
      <Card>
        <CardContent>
          <div className="receipts-toolbar">
            <p className="muted">
              {live
                ? "Sales invoice drafts"
                : "Demo · invoices saved in this browser"}{" "}
              · GBP
            </p>
            <div>
              <Label htmlFor="invoice-search" className="sr-only">
                Search invoices
              </Label>
              <Input
                id="invoice-search"
                placeholder="Search invoices…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {download && (
            <div className="invoice-download" role="status">
              <Button asChild variant="outline">
                <a
                  href={download.url}
                  download={download.filename}
                  referrerPolicy="no-referrer"
                >
                  <Download size={15} />
                  Download {download.number} PDF
                </a>
              </Button>
              {live && (
                <Button asChild variant="link">
                  <a href={download.publicUrl} target="_blank" rel="noreferrer">
                    View public invoice
                  </a>
                </Button>
              )}
              {live && (
                <div className="w-full">
                  <Label htmlFor="public-invoice-url">Public invoice URL</Label>
                  <Input
                    id="public-invoice-url"
                    readOnly
                    value={download.publicUrl}
                  />
                </div>
              )}
              <small>
                {live
                  ? "Anyone with the public URL can view this invoice."
                  : "Demo PDF · fictional data. Sign in to create public links."}
              </small>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued / due</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Download</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.number}</TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell>
                    {invoice.issueDate}
                    <br />
                    <small className="muted">Due {invoice.dueDate}</small>
                  </TableCell>
                  <TableCell>{money(invoice.totalPence)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Draft</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy !== null}
                      aria-label={`Get PDF link for ${invoice.number}`}
                      onClick={() => void prepare(invoice)}
                    >
                      {busy === invoice.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Download size={15} />
                      )}
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="empty">
                    {items.length
                      ? "No matching invoices."
                      : "No invoices yet. Create your first draft invoice."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="hint">
            Drafts do not create sales journals or record payments.
          </p>
        </CardContent>
      </Card>
      {open && (
        <InvoiceDialog
          open
          onClose={() => setOpen(false)}
          onCreate={async (input) => {
            const invoice = await onCreate(input);
            void prepare(invoice);
            return invoice;
          }}
          company={company}
          live={live}
        />
      )}
    </>
  );
}

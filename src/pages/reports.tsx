import { FileCheck2, Download, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { journal, money, type Receipt, type Company } from "../domain";
export default function Reports({
  page,
  items,
  company,
}: {
  page: string;
  items: Receipt[];
  company: Company;
}) {
  const start = company.tradingStart,
    end = company.yearEnd;
  const posted = items.filter(
    (r) => r.status === "posted" && r.date >= start && r.date <= end,
  );
  const lines = posted.flatMap(journal);
  const expenses = lines
    .filter((l) => l.account.startsWith("5000"))
    .reduce((n, l) => n + l.debit, 0);
  const vat = posted.reduce((n, r) => n + r.decision.reclaimPence, 0);
  const equipment = lines
    .filter((l) => l.account.startsWith("1500"))
    .reduce((n, l) => n + l.debit, 0);
  const creditors = posted.reduce((n, r) => n + r.netPence + r.vatPence, 0);
  const director = lines
    .filter((l) => l.account.startsWith("2100"))
    .reduce((n, l) => n + l.debit, 0);
  const isVat = page === "VAT",
    isTax = page === "Corporation Tax";
  const rows = isVat
    ? [
        ["Input VAT from posted purchases", money(vat)],
        ["Output VAT", "Sales not imported"],
        [
          "Net VAT payable / refundable",
          "Pending sales and period reconciliation",
        ],
      ]
    : isTax
      ? [
          ["Recorded expense total", money(expenses)],
          ["Accounting result", "Incomplete: sales and adjustments needed"],
          [
            "Corporation Tax calculation",
            "Pending tax adjustments and allowances",
          ],
          ["CT600 / iXBRL", "Not generated"],
        ]
      : [
          ["Equipment at cost", money(equipment)],
          ["VAT recoverable", money(vat)],
          ["Director loan debit balance", money(director)],
          ["Trade creditors", money(creditors)],
          ["Expenses recognised", money(expenses)],
          [
            "Result and equity",
            "Pending sales, opening balances and adjustments",
          ],
        ];
  function download() {
    const data = {
      title: page,
      company: company.name,
      period: { start, end },
      status: "draft",
      scope: "Internal working paper. Incomplete; not suitable for filing.",
      figures: Object.fromEntries(rows),
      receiptIds: posted.map((r) => r.id),
    };
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = page.toLowerCase().replaceAll(" ", "-") + "-draft.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE SAME DATA. A CLEARER PICTURE.</p>
          <h1>
            {page}
            <span>.</span>
          </h1>
          <p>
            {isVat
              ? "Keep an eye on recovery, registration and the records behind every number."
              : isTax
                ? "Start with the books. Prepare the evidence for your company tax return."
                : "A working paper built from your ledger, ready to grow with your business."}
          </p>
        </div>
        <Button variant="outline" onClick={download}>
          <Download size={16} />
          Export draft
        </Button>
      </div>
      <Card>
        <CardContent>
          <div className="section-heading">
            <div>
              <h3>
                <FileCheck2 size={18} />
                {company.name}
              </h3>
              <p>
                {start} → {end} · Based on {posted.length} posted receipts
              </p>
            </div>
            <Badge variant="secondary">Draft working paper</Badge>
          </div>
          <div className="lifecycle">
            {["Draft", "Validated", "Approved", "Sent", "Accepted"].map(
              (s, i) => (
                <span className={i === 0 ? "active" : ""} key={s}>
                  {String(i + 1).padStart(2, "0")}
                  <strong>{s}</strong>
                </span>
              ),
            )}
          </div>
          {rows.map(([k, v]) => (
            <div className="report-line" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
          <p className="hint">
            Validation is pending complete books, comparative figures and
            supporting evidence. Generation, submission and payment tracking are
            separate capabilities. No return has been filed.
          </p>
        </CardContent>
      </Card>
      {isVat && (
        <Card className="threshold-card">
          <CardContent>
            <h3>VAT registration watch</h3>
            <p className="muted">
              {company.vatRegistered
                ? "Your company is marked as VAT registered."
                : "Track rolling 12-month taxable turnover even before registering."}
            </p>
            <div className="threshold-value">
              £90,000 <small>current registration threshold</small>
            </div>
            <p>
              Sales and reverse-charge imports are needed to calculate your
              rolling taxable turnover. The expected next-30-days test must also
              be checked.
            </p>
            <Button asChild variant="link">
              <a
                href="https://www.gov.uk/register-for-vat"
                target="_blank"
                rel="noreferrer"
              >
                Check HMRC registration guidance <ArrowUpRight size={14} />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

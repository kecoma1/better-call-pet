import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  ReceiptText,
  Clock3,
  CheckCheck,
  Wallet,
  ShieldCheck,
  FolderCheck,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import NotificationsBanner from "../components/notifications-banner";
import ReceiptTable from "../components/receipt-table";
import { money, type Receipt, type Company } from "../domain";
export default function Overview({
  items,
  company,
  onAdd,
  onSelect,
  onNavigate,
}: {
  items: Receipt[];
  company: Company;
  onAdd: () => void;
  onSelect: (r: Receipt) => void;
  onNavigate: (p: string) => void;
}) {
  const posted = items.filter((r) => r.status === "posted"),
    waiting = items.filter((r) => r.status === "review");
  const spent = posted.reduce((n, r) => n + r.netPence + r.vatPence, 0),
    vat = posted.reduce((n, r) => n + r.decision.reclaimPence, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p>
          <h1>
            Your books, in good hands<span>.</span>
          </h1>
          <p>
            Less paperwork. More peace of mind. Let’s keep your LTD in order.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus size={16} />
          Add receipt
        </Button>
      </div>
      <NotificationsBanner
        items={items}
        onSelect={onSelect}
        onAdd={onAdd}
        onNavigate={onNavigate}
      />
      <div className="stat-grid">
        {[
          {
            label: "Recorded purchases",
            value: money(spent),
            sub: `${posted.length} posted transactions`,
            icon: Wallet,
          },
          {
            label: "VAT to reclaim",
            value: money(vat),
            sub: company.vatRegistered
              ? "From posted business purchases"
              : "Not VAT registered",
            icon: ReceiptText,
          },
          {
            label: "Needs your attention",
            value: String(waiting.length).padStart(2, "0"),
            sub: "Receipts ready for a review",
            icon: Clock3,
          },
          {
            label: "Books in order",
            value: String(posted.length).padStart(2, "0"),
            sub: "Reviewed and posted",
            icon: CheckCheck,
          },
        ].map((s) => (
          <Card className="stat-card" key={s.label}>
            <CardContent>
              <div>
                <span>{s.label}</span>
                <s.icon size={17} />
              </div>
              <strong>{s.value}</strong>
              <small>{s.sub}</small>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overview-lower">
        <Card className="transactions-card">
          <CardContent>
            <div className="section-heading">
              <div>
                <h3>Recent receipts</h3>
                <p>A little review now. A lot less work later.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("Receipts")}
              >
                View all <ArrowUpRight size={15} />
              </Button>
            </div>
            <ReceiptTable items={items.slice(0, 4)} onSelect={onSelect} />
          </CardContent>
        </Card>
        <Card className="next-card">
          <CardContent>
            <span className="eyebrow">ON THE HORIZON</span>
            <h3>Your next steps</h3>
            <div className="next-item">
              <span>
                <FolderCheck size={17} />
              </span>
              <div>
                <strong>Keep your records tidy</strong>
                <p>
                  {waiting.length
                    ? `${waiting.length} receipts need a quick check.`
                    : "All caught up. Nice work."}
                </p>
                <Button variant="link" onClick={() => onNavigate("Receipts")}>
                  Review receipts <ArrowRight size={13} />
                </Button>
              </div>
            </div>
            <div className="next-item">
              <span>
                <CalendarDays size={17} />
              </span>
              <div>
                <strong>Financial year end</strong>
                <p>
                  {new Date(company.yearEnd + "T12:00:00Z").toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </p>
                <small>Set up your LTD to prepare.</small>
              </div>
            </div>
            <div className="next-foot">
              <ShieldCheck size={14} />
              Your approval is always the final word.
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="workspace-footer">
        <span>
          <span className="online-dot" />
          ALL YOUR NUMBERS. ONE WORKSPACE.
        </span>
        <span>Built for the little business with big plans.</span>
      </div>
    </>
  );
}

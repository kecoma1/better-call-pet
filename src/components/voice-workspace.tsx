import { CheckCheck, Clock3, Files, ReceiptText, RefreshCw } from "lucide-react";
import { money, type Receipt } from "../domain";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

export default function VoiceWorkspace({ receipts, refreshing, error, onRefresh }: {
  receipts: Receipt[];
  refreshing: boolean;
  error: string;
  onRefresh?: () => void;
}) {
  const posted = receipts.filter((receipt) => receipt.status === "posted");
  const waiting = receipts.length - posted.length;
  const recent = [...receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const stats = [
    { label: "Receipts loaded", value: receipts.length, icon: Files },
    { label: "Awaiting review", value: waiting, icon: Clock3 },
    { label: "Posted to books", value: posted.length, icon: CheckCheck },
    { label: "Posted VAT", value: money(posted.reduce((sum, receipt) => sum + receipt.decision.reclaimPence, 0)), icon: ReceiptText },
  ];

  return (
    <aside className="voice-workspace" aria-label="Workspace during call" aria-busy={refreshing}>
      <div className="voice-workspace-heading">
        <div>
          <h3>Your workspace</h3>
          <p>{refreshing ? "Updating your records…" : "Your records, at a glance."}</p>
        </div>
        {onRefresh && <Button type="button" variant="ghost" size="icon" aria-label="Refresh workspace" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} />
        </Button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="voice-workspace-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="gap-0 py-3 shadow-none">
            <CardContent className="px-3">
              <div className="voice-stat-label"><span>{label}</span><Icon size={14} aria-hidden="true" /></div>
              <strong className="voice-stat-value">{value}</strong>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 py-4 shadow-none">
        <CardContent className="px-4">
          <div className="voice-receipts-heading"><h4>Recent receipts</h4><Badge variant="secondary">{receipts.length}</Badge></div>
          {recent.length ? <ul className="voice-receipts">
            {recent.map((receipt) => <li key={receipt.id}>
              <ReceiptText size={16} aria-hidden="true" />
              <div className="voice-receipt-details">
                <strong>{receipt.vendor}</strong>
                <small>{receipt.reference || receipt.category}</small>
                <Badge variant="outline">{receipt.status === "posted" ? "Posted" : "Awaiting review"}</Badge>
              </div>
              <span className="voice-receipt-amount">{money(receipt.netPence + receipt.vatPence)}</span>
            </li>)}
          </ul> : <div className="voice-receipts-empty">
            <Files size={24} aria-hidden="true" />
            <p>No receipts loaded yet.</p>
            <small>Receipts you add will appear here.</small>
          </div>}
          <p className="voice-workspace-note">Draft receipts stay in review until you approve them.</p>
        </CardContent>
      </Card>
    </aside>
  );
}

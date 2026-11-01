import { useState, useEffect } from "react";
import {
  Save,
  PlugZap,
  Copy,
  Check,
  ExternalLink,
  Unplug,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import Saul from "../components/saul";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { fetchConnections, revokeConnection } from "../services/workspace";
import type { Company } from "../domain";
export default function Settings({
  company,
  onSave,
  live,
}: {
  company: Company;
  onSave: (c: Company) => Promise<void>;
  live: boolean;
}) {
  const [form, setForm] = useState(company),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false),
    [connections, setConnections] = useState<
      { id: string; name: string; scope: string }[]
    >([]);
  useEffect(() => setForm(company), [company]);
  useEffect(() => {
    if (!live) return;
    const c = new AbortController();
    fetchConnections(c.signal)
      .then(setConnections)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [live]);
  const change = (k: keyof Company, v: unknown) => {
    setForm((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h1>
            Your workspace<span>.</span>
          </h1>
          <p>A few details now. Better books from the start.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Card>
          <CardContent>
            <h3>LTD details</h3>
            <form
              className="settings-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await onSave(form);
                  setSaved(true);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {(
                [
                  ["name", "Legal company name", "text"],
                  ["number", "Companies House number", "text"],
                  ["utr", "Corporation Tax UTR", "text"],
                  ["tradingStart", "Start of trading", "date"],
                  ["yearEnd", "Financial year end", "date"],
                  ["vatNumber", "VAT number", "text"],
                ] as const
              ).map(([k, l, t]) => (
                <div key={k}>
                  <Label htmlFor={"company-" + k}>{l}</Label>
                  <Input
                    id={"company-" + k}
                    type={t}
                    value={form[k]}
                    required={["name", "tradingStart", "yearEnd"].includes(k)}
                    onChange={(e) => change(k, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="vat-registered">VAT registration</Label>
                <Select
                  value={form.vatRegistered ? "registered" : "unregistered"}
                  onValueChange={(v) =>
                    change("vatRegistered", v === "registered")
                  }
                >
                  <SelectTrigger id="vat-registered">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registered">VAT registered</SelectItem>
                    <SelectItem value="unregistered">
                      Not registered yet
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vat-scheme">VAT scheme</Label>
                <Select
                  value={form.vatScheme}
                  onValueChange={(v) => change("vatScheme", v)}
                >
                  <SelectTrigger id="vat-scheme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard accrual</SelectItem>
                    <SelectItem value="flat_rate">Flat Rate Scheme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy}>
                {saved ? <Check size={16} /> : <Save size={16} />}{" "}
                {busy ? "Saving…" : saved ? "Saved" : "Save company details"}
              </Button>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
        <div>
          <Card className="dot-connect-card">
            <CardContent>
              <div className="section-heading">
                <h3>
                  <PlugZap size={18} />
                  Connect your Dot
                </h3>
                <span className="connection-label">MCP + OAuth</span>
              </div>
              <div className="dot-connect-scene">
                <Saul state="seated" className="dot-connect-saul" />
                <a
                  className="dot-connect-characters"
                  href="/connect"
                  aria-label="Connect Saul with your Dot"
                >
                  <img
                    src="/chibi/dots-characters.png"
                    alt="Blue, green, yellow and pink Dots characters"
                    width={640}
                    height={320}
                  />
                </a>
              </div>
              <div className="dot-connect-intro">
                <p className="eyebrow">GOOD COMPANY. BETTER BOOKS.</p>
                <h4>Saul, meet your Dot.</h4>
                <p className="muted">
                  Your favourite assistant. Your accounting sidekick. Bring them
                  together.
                </p>
                <Button asChild>
                  <a href="/connect">
                    Connect your Dot <ArrowUpRight size={15} />
                  </a>
                </Button>
              </div>
              <p className="muted">
                Bring your accounting workspace into your assistant. Sign in in
                your browser and choose what it can access.
              </p>
              <ol className="connect-steps">
                <li>Open your Dot’s connector settings.</li>
                <li>Add a remote MCP server with this address.</li>
                <li>Choose OAuth and approve access in the browser.</li>
              </ol>
              <div className="mcp-url">
                <code>https://rent-o-accountant.web.app/mcp</code>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Copy MCP URL"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        "https://rent-o-accountant.web.app/mcp",
                      );
                      setCopied(true);
                    } catch {
                      setError(
                        "Copy the address above. Clipboard access is unavailable.",
                      );
                    }
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </Button>
              </div>
              <p className="hint">
                No API key to paste into a chat. The same tools power Dot and
                the in-app agent. Your Dot must support remote MCP with OAuth.
              </p>
              <Button asChild variant="outline">
                <a href="/connect">
                  Connection guide <ExternalLink size={14} />
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card className="connections-card">
            <CardContent>
              <h3>Connected assistants</h3>
              {connections.length ? (
                connections.map((c) => (
                  <div key={c.id} className="connection-row">
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.scope}</small>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Disconnect " + c.name}
                      onClick={async () => {
                        try {
                          await revokeConnection(c.id);
                          setConnections((prev) =>
                            prev.filter((x) => x.id !== c.id),
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      <Unplug size={16} />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="muted">
                  {live
                    ? "No assistants connected yet."
                    : "Sign in to manage your connected assistants."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

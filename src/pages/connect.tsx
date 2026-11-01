import { useEffect, useState } from "react";
import { PlugZap, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { previewConsent, approveConsent } from "../services/workspace";
export default function Connect({
  live,
  onLogin,
}: {
  live: boolean;
  onLogin: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<{
      client_name: string;
      scope: string;
      redirect_uri: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const request = !!query.client_id;
  useEffect(() => {
    if (!live || !request) return;
    let active = true;
    previewConsent(query)
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [live, request]);
  return (
    <div className="connect-page">
      <Card>
        <CardContent>
          <PlugZap size={32} />
          <p className="eyebrow">BETTER CALL PET · SECURE CONNECTION</p>
          <h1>
            {request ? "Let your assistant lend a hand." : "Connect your Dot."}
          </h1>
          {preview ? (
            <>
              <p>
                <strong>{preview.client_name}</strong> wants to access your
                workspace.
              </p>
              <p>
                {preview.scope.includes("accounts:read") &&
                  "Read company details, receipts and invoice drafts; download invoice PDFs and retrieve public links. "}
                {preview.scope.includes("receipts:write") &&
                  "Create receipt drafts and update company settings. "}
                {preview.scope.includes("invoices:write") &&
                  "Create invoice drafts with a PDF and a public URL anyone can view. "}
              </p>
              <p className="hint">
                Callback: {new URL(preview.redirect_uri).origin}
              </p>
              <p>
                <ShieldCheck size={16} />
                Your assistant cannot approve entries or submit tax returns.
              </p>
            </>
          ) : (
            <p>
              {request
                ? "Sign in, then review the requested permissions."
                : "Add https://rent-o-accountant.web.app/mcp in your assistant’s remote MCP settings, then select OAuth. Your assistant will open this page to request permission."}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!live ? (
            <Button
              onClick={async () => {
                try {
                  await onLogin();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Sign in with Google
            </Button>
          ) : request ? (
            <div className="consent-actions">
              <Button variant="outline" asChild>
                <a href="/">Cancel</a>
              </Button>
              <Button
                disabled={!preview || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const d = await approveConsent(query);
                    location.assign(d.redirect);
                  } catch (e) {
                    setError((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Connecting…" : "Allow connection"}
              </Button>
            </div>
          ) : (
            <Button asChild>
              <a href="/">Back to workspace</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

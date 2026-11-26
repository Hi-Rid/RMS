"use client";

import * as React from "react";
import { Copy, Check, RefreshCw, Key, Smartphone, Terminal, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { toast } from "sonner";
import { rotateIngestToken } from "@/lib/actions/settings";

interface IngestTokenCardProps {
  initialHasToken: boolean;
  tokenHint?: string | null;
  tokenRotatedAt?: string | null;
  appUrl?: string;
  hasConfiguredAppUrl?: boolean;
}

const TOKEN_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

export function IngestTokenCard({
  initialHasToken,
  tokenHint,
  tokenRotatedAt,
  appUrl,
  hasConfiguredAppUrl = true,
}: IngestTokenCardProps) {
  const [hasToken, setHasToken] = React.useState(initialHasToken);
  const [currentHint, setCurrentHint] = React.useState<string | null>(tokenHint ?? null);
  const [currentRotatedAt, setCurrentRotatedAt] = React.useState<string | null>(
    tokenRotatedAt ?? null
  );
  const [freshToken, setFreshToken] = React.useState<string | null>(null);
  const [isRotating, setIsRotating] = React.useState(false);
  const [copiedToken, setCopiedToken] = React.useState(false);
  const [copiedCurl, setCopiedCurl] = React.useState(false);
  const [confirmRotateOpen, setConfirmRotateOpen] = React.useState(false);
  const [resolvedOrigin, setResolvedOrigin] = React.useState(
    (appUrl || "https://<your-app-domain>").replace(/\/+$/, "")
  );

  React.useEffect(() => {
    if (
      (!hasConfiguredAppUrl || !appUrl || appUrl.includes("localhost")) &&
      typeof window !== "undefined"
    ) {
      setResolvedOrigin(window.location.origin.replace(/\/+$/, ""));
    }
  }, [appUrl, hasConfiguredAppUrl]);

  const endpointBase = resolvedOrigin;
  const ingestEndpoint = `${endpointBase}/api/ingest`;
  const isLocalTarget = endpointBase.includes("localhost") || endpointBase.includes("127.0.0.1");

  const curlSnippet = `curl -X POST "${ingestEndpoint}" \\\n  -H "Authorization: Bearer ${freshToken || "<TOKEN>"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://instagram.com/reel/XYZ"}'`;

  const rotatedLabel = React.useMemo(() => {
    if (!currentRotatedAt) return null;
    const d = new Date(currentRotatedAt);
    if (Number.isNaN(d.getTime())) return null;
    return `${TOKEN_DATE_FORMATTER.format(d)} WIB`;
  }, [currentRotatedAt]);

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      const res = await rotateIngestToken();
      if (res.ok) {
        setFreshToken(res.data.token);
        setHasToken(true);
        setCurrentHint(res.data.token.slice(-4));
        setCurrentRotatedAt(new Date().toISOString());
        setConfirmRotateOpen(false);
        toast.success("New ingest token generated. Copy it now before leaving.");
      } else {
        toast.error(res.error.message || "Failed to rotate token");
      }
    } catch {
      toast.error("Failed to rotate ingest token");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopiedToken(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      toast.error("Clipboard blocked — select and copy the token manually");
    }
  };

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlSnippet);
      setCopiedCurl(true);
      toast.success("cURL command copied");
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      toast.error("Clipboard blocked — copy command manually");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border bg-card p-6 shadow-none">
        <CardHeader className="p-0 pb-4 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Key className="size-4 text-foreground" />
              <CardTitle className="text-base font-bold font-display">Ingest API Token</CardTitle>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${
                hasToken
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {hasToken ? "Token Configured" : "No Token"}
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            A secret 32-byte Bearer token used by iOS Shortcuts, browser extensions, and curl to save references to RMS.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-4 pt-2">
          {isLocalTarget && (
            <div
              role="note"
              className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs font-mono text-foreground flex items-start gap-2.5"
            >
              <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Currently targeting <strong>{endpointBase}</strong>. External mobile devices (iOS Shortcuts) require your deployed HTTPS domain or <code>NEXT_PUBLIC_APP_URL</code>.
              </span>
            </div>
          )}

          {freshToken ? (
            <div className="space-y-2.5 p-3.5 rounded-lg border border-primary/40 bg-secondary/40">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
                <span className="font-semibold text-foreground">Your New Secret Token:</span>
                <span className="text-[11px] text-destructive font-bold">
                  Copy now — it will not be shown again!
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Generated API Ingest Token"
                  value={freshToken}
                  className="flex-1 h-9 px-3 rounded-md bg-background border border-border font-mono text-xs text-foreground select-all"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyToken}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider shrink-0"
                >
                  {copiedToken ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  <span>{copiedToken ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-secondary/20 border border-border/60">
              <div className="space-y-1 text-xs font-mono">
                <div className="text-foreground">
                  {hasToken
                    ? "Token is securely hashed (SHA-256) in database."
                    : "No ingest token has been generated yet."}
                </div>
                {hasToken && (currentHint || rotatedLabel) && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {currentHint && (
                      <span className="px-1.5 py-0.5 rounded bg-background border border-border font-mono">
                        ••••{currentHint}
                      </span>
                    )}
                    {rotatedLabel && <span>Rotated {rotatedLabel}</span>}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRotateOpen(true)}
                disabled={isRotating}
                className="h-8 rounded-md text-xs font-mono uppercase tracking-wider shrink-0"
              >
                <RefreshCw className={`size-3 mr-1.5 ${isRotating ? "animate-spin" : ""}`} />
                <span>{hasToken ? "Rotate Token" : "Generate Token"}</span>
              </Button>
            </div>
          )}

          {freshToken && (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmRotateOpen(true)}
                disabled={isRotating}
                className="h-7 rounded-md text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
              >
                Regenerate again
              </Button>
            </div>
          )}

          <ConfirmDialog
            open={confirmRotateOpen}
            onOpenChange={setConfirmRotateOpen}
            title={hasToken ? "Rotate Ingest API Token?" : "Generate Ingest API Token?"}
            description={
              hasToken
                ? "Generating a new token will immediately invalidate your existing token. Any iOS Shortcuts, bookmarklets, or scripts using the old token will stop working until updated."
                : "This creates a secret 32-byte Bearer token for iOS Shortcuts and external ingest clients. Copy it right after generation."
            }
            confirmLabel={hasToken ? "Rotate Token" : "Generate Token"}
            variant={hasToken ? "destructive" : "default"}
            isPending={isRotating}
            onConfirm={handleRotate}
          />
        </CardContent>
      </Card>

      {/* Integration Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* iOS Shortcut Guide */}
        <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-foreground" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
              iOS Shortcut Setup
            </h3>
          </div>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside leading-relaxed font-sans">
            <li>
              Open iOS <strong>Shortcuts</strong> app &rarr; <strong>+</strong> &rarr; name it <strong>Save to RMS</strong>.
            </li>
            <li>
              Tap (i) &rarr; enable <strong>Show in Share Sheet</strong> &rarr; accept <strong>URLs</strong> and <strong>Text</strong>.
            </li>
            <li>
              Add action <strong>Get Contents of URL</strong>:
              <ul className="list-disc list-inside pl-3 pt-1 text-[11px] font-mono text-foreground space-y-0.5 break-all">
                <li>
                  URL: <span className="text-muted-foreground">{ingestEndpoint}</span>
                </li>
                <li>
                  Method: <span className="text-muted-foreground">POST</span>
                </li>
                <li>
                  Header: <span className="text-muted-foreground">Authorization: Bearer &lt;TOKEN&gt;</span>
                </li>
                <li>
                  Body (JSON): <span className="text-muted-foreground">key &quot;text&quot; = Shortcut Input</span>
                </li>
              </ul>
            </li>
            <li>
              Add <strong>Get Dictionary Value</strong> (key <code>status</code>) &rarr; <strong>Show Notification</strong>.
            </li>
          </ol>
        </Card>

        {/* cURL & Developer Guide */}
        <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-foreground" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                cURL / Webhook Example
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCurl}
              className="h-7 px-2 text-[11px] font-mono gap-1"
            >
              {copiedCurl ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              <span>{copiedCurl ? "Copied" : "Copy cURL"}</span>
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Post JSON or raw text to save references automatically:
            </p>
            <pre className="p-2.5 rounded-lg bg-secondary/50 border border-border text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed">
              {curlSnippet}
            </pre>
            <p className="text-[11px] font-mono text-muted-foreground">
              Returns <code>201 created</code> (plus AI <code>summary</code>, <code>hookText</code> &amp; optional <code>draftContentTitle</code>) or <code>200 duplicate</code>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

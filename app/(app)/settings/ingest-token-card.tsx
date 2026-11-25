"use client";

import * as React from "react";
import { Copy, Check, RefreshCw, Key, Smartphone, Terminal, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { rotateIngestToken } from "@/lib/actions/settings";

interface IngestTokenCardProps {
  initialHasToken: boolean;
}

export function IngestTokenCard({ initialHasToken }: IngestTokenCardProps) {
  const [hasToken, setHasToken] = React.useState(initialHasToken);
  const [freshToken, setFreshToken] = React.useState<string | null>(null);
  const [isRotating, setIsRotating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [confirmRotateOpen, setConfirmRotateOpen] = React.useState(false);

  const handleRotate = async () => {
    setConfirmRotateOpen(false);
    setIsRotating(true);
    try {
      const res = await rotateIngestToken();
      if (res.ok) {
        setFreshToken(res.data.token);
        setHasToken(true);
        toast.success("New ingest token generated! Copy it now.");
      } else {
        toast.error(res.error.message || "Failed to rotate token");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = () => {
    if (!freshToken) return;
    navigator.clipboard.writeText(freshToken);
    setCopied(true);
    toast.success("Token copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border bg-card p-6 shadow-none">
        <CardHeader className="p-0 pb-4 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="size-4 text-foreground" />
              <CardTitle className="text-base font-bold font-display">Ingest API Token</CardTitle>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${
                hasToken ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-muted-foreground"
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
          {freshToken ? (
            <div className="space-y-2 p-3.5 rounded-lg border border-primary/40 bg-secondary/40">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-foreground">Your New Secret Token:</span>
                <span className="text-[11px] text-destructive font-bold">Copy now, it will not be shown again!</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={freshToken}
                  className="flex-1 h-9 px-3 rounded-md bg-background border border-border font-mono text-xs text-foreground select-all"
                />
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider shrink-0"
                >
                  {copied ? <Check className="size-3.5 mr-1" /> : <Copy className="size-3.5 mr-1" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/60">
              <span className="text-xs text-muted-foreground font-mono">
                {hasToken
                  ? "Token is securely hashed (SHA-256) in database."
                  : "No ingest token has been generated yet."}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRotateOpen(true)}
                disabled={isRotating}
                className="h-8 rounded-md text-xs font-mono uppercase tracking-wider"
              >
                <RefreshCw className={`size-3 mr-1.5 ${isRotating ? "animate-spin" : ""}`} />
                <span>{hasToken ? "Rotate Token" : "Generate Token"}</span>
              </Button>
            </div>
          )}

          {freshToken && (
            <div className="flex justify-end pt-1">
              <Button
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

          <AlertDialog open={confirmRotateOpen} onOpenChange={setConfirmRotateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {hasToken ? "Rotate Ingest API Token?" : "Generate Ingest API Token?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {hasToken
                    ? "Generating a new token will immediately invalidate your existing token. Any iOS Shortcuts, bookmarklets, or scripts using the old token will stop working until updated."
                    : "This creates a secret 32-byte Bearer token for iOS Shortcuts and external ingest clients. Copy it right after generation."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant={hasToken ? "destructive" : "default"} onClick={handleRotate}>
                  {hasToken ? "Rotate Token" : "Generate Token"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              Tap (ⓘ) &rarr; enable <strong>Show in Share Sheet</strong> &rarr; accept <strong>URLs</strong> and <strong>Text</strong>.
            </li>
            <li>
              Add action <strong>Get Contents of URL</strong>:
              <ul className="list-disc list-inside pl-3 pt-1 text-[11px] font-mono text-foreground space-y-0.5">
                <li>URL: <span className="text-muted-foreground">https://&lt;app&gt;/api/ingest</span></li>
                <li>Method: <span className="text-muted-foreground">POST</span></li>
                <li>Header: <span className="text-muted-foreground">Authorization: Bearer &lt;TOKEN&gt;</span></li>
                <li>Body (JSON): <span className="text-muted-foreground">key &quot;text&quot; = Shortcut Input</span></li>
              </ul>
            </li>
            <li>
              Add <strong>Get Dictionary Value</strong> (key <code>status</code>) &rarr; <strong>Show Notification</strong>.
            </li>
          </ol>
        </Card>

        {/* cURL & Developer Guide */}
        <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-foreground" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
              cURL / Webhook Example
            </h3>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Post JSON or raw text to save references automatically:
            </p>
            <pre className="p-2.5 rounded-lg bg-secondary/50 border border-border text-[11px] font-mono text-foreground overflow-x-auto leading-relaxed">
{`curl -X POST "https://<app>/api/ingest" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://instagram.com/reel/XYZ"}'`}
            </pre>
            <p className="text-[11px] font-mono text-muted-foreground">
              Returns <code>201 created</code> or <code>200 duplicate</code>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

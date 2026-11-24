"use client";

import * as React from "react";
import { Plus, Upload, Link as LinkIcon, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AddLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLinksDialog({ open, onOpenChange }: AddLinksDialogProps) {
  const [linksText, setLinksText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksText.trim()) {
      toast.error("Please paste at least one URL");
      return;
    }

    setIsSubmitting(true);
    // Placeholder response for P2 (Full ingest batch action arrives in P4)
    setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Links queued for inbox triage");
      setLinksText("");
      onOpenChange(false);
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-lg border bg-card p-6 shadow-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-display">Add References</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste links from Instagram, TikTok, YouTube, or upload export files.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="w-full mt-2">
          <TabsList className="grid w-full grid-cols-2 bg-secondary rounded-md p-1">
            <TabsTrigger value="paste" className="rounded-md text-xs font-mono uppercase tracking-wider">
              Paste Links
            </TabsTrigger>
            <TabsTrigger value="file" className="rounded-md text-xs font-mono uppercase tracking-wider">
              From File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-4 space-y-4">
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Textarea
                  placeholder="Paste URLs (one per line, up to 50 links) or share sheet text..."
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  className="min-h-[140px] rounded-lg border-input text-xs font-mono leading-relaxed"
                  disabled={isSubmitting}
                  autoFocus
                />
                <p className="text-[11px] font-mono text-muted-foreground">
                  URL tracking parameters (utm, igsh, etc.) are stripped automatically.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-[34px] rounded-control text-xs font-mono uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !linksText.trim()}
                  className="h-[34px] rounded-control bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider"
                >
                  {isSubmitting ? "Adding..." : "Add to Inbox"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="file" className="mt-4 space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-2 bg-muted/40">
              <Upload className="mx-auto size-8 text-muted-foreground" />
              <div className="text-xs font-medium text-foreground">
                Drop your Instagram or TikTok export file
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                Supports .json, .html, .txt up to 5 MB
              </div>
              <input
                type="file"
                accept=".json,.html,.txt"
                className="hidden"
                id="file-upload"
                onChange={() => {
                  toast.info("Full batch file import available in Ingest setup");
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="h-[34px] rounded-control text-xs font-mono uppercase tracking-wider mt-2"
              >
                Browse file
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

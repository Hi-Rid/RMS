"use client";

import * as React from "react";
import { Plus, Upload, Link as LinkIcon, AlertCircle, CheckCircle2, FileText, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createReferencesFromText,
  previewImport,
  importReferencesFromUrls,
  type ImportPreviewItem,
} from "@/lib/actions/references";

interface AddLinksDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AddLinksDialog({ open, onOpenChange, children }: AddLinksDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [linksText, setLinksText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // File import state
  const [fileLoading, setFileLoading] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<{
    total: number;
    newCount: number;
    duplicateCount: number;
    items: ImportPreviewItem[];
  } | null>(null);

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksText.trim()) {
      toast.error("Please paste at least one URL");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createReferencesFromText({ text: linksText });
      if (res.ok) {
        const { totalProcessed, createdCount } = res.data;
        const dupes = totalProcessed - createdCount;
        if (createdCount > 0) {
          toast.success(
            `Added ${createdCount} reference${createdCount > 1 ? "s" : ""} to Inbox${
              dupes > 0 ? ` (${dupes} already saved)` : ""
            }`
          );
        } else {
          toast.info(`All ${totalProcessed} links are already in your references`);
        }
        setLinksText("");
        setIsOpen(false);
      } else {
        toast.error(res.error.message || "Failed to process references");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setFileLoading(false);
        toast.error("File is empty");
        return;
      }

      try {
        const res = await previewImport({ text: content });
        if (res.ok) {
          setPreviewData(res.data);
          if (res.data.total === 0) {
            toast.info("No recognizable video or post URLs found in file");
          }
        } else {
          toast.error(res.error.message || "Failed to parse file");
        }
      } catch {
        toast.error("Failed to read file");
      } finally {
        setFileLoading(false);
      }
    };

    reader.onerror = () => {
      setFileLoading(false);
      toast.error("Error reading file");
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.newCount === 0) return;

    setIsSubmitting(true);
    const newUrls = previewData.items.filter((i) => i.status === "new").map((i) => i.url);

    try {
      const res = await importReferencesFromUrls({ urls: newUrls });
      if (res.ok) {
        toast.success(`Successfully imported ${res.data.created} references`);
        setPreviewData(null);
        setIsOpen(false);
      } else {
        toast.error(res.error.message || "Import failed");
      }
    } catch {
      toast.error("An error occurred during import");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md rounded-lg border bg-card p-6 shadow-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-display">Add References</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste links from Instagram, TikTok, YouTube, or upload saved exports.
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
                  Tracking params (utm, igsh, si, etc.) are stripped automatically.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
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
            {!previewData ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3 bg-muted/40">
                <div className="mx-auto size-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <Upload className="size-4" />
                </div>
                <div>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-xs font-semibold text-primary underline underline-offset-4"
                  >
                    Select an export file (.json, .html, .txt)
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".json,.html,.txt,.csv"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={fileLoading}
                  />
                  <p className="text-[11px] font-mono text-muted-foreground mt-1">
                    Instagram Saved HTML/JSON, TikTok bookmarks, or URL lists
                  </p>
                </div>
                {fileLoading && (
                  <div className="text-xs font-mono text-muted-foreground animate-pulse">
                    Scanning file for video and post links...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-secondary/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Scanned links:</span>
                    <span className="font-bold text-foreground">{previewData.total}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">New to import:</span>
                    <span className="font-bold text-primary">{previewData.newCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Already saved (skipped):</span>
                    <span className="text-muted-foreground">{previewData.duplicateCount}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewData(null)}
                    className="text-xs font-mono text-muted-foreground"
                  >
                    Upload another file
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="text-xs font-mono uppercase tracking-wider"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={previewData.newCount === 0 || isSubmitting}
                      onClick={handleConfirmImport}
                      className="bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider"
                    >
                      {isSubmitting ? "Importing..." : `Import ${previewData.newCount} New`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

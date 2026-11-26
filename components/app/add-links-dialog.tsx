"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle, Link as LinkIcon } from "lucide-react";
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

const URL_COUNT_REGEX = /(?:https?:\/\/[^\s"'<>]+|(?:instagram\.com|www\.instagram\.com|tiktok\.com|vt\.tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|threads\.net)\/[^\s"'<>]+)/gi;

export function AddLinksDialog({ open, onOpenChange, children }: AddLinksDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [linksText, setLinksText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [invalidNote, setInvalidNote] = React.useState<string | null>(null);

  // File import state
  const [fileLoading, setFileLoading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<{
    total: number;
    newCount: number;
    duplicateCount: number;
    items: ImportPreviewItem[];
  } | null>(null);

  const detectedUrlCount = React.useMemo(() => {
    if (!linksText.trim()) return 0;
    const matches = linksText.match(URL_COUNT_REGEX);
    return matches ? matches.length : 0;
  }, [linksText]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && (isSubmitting || fileLoading)) {
      return;
    }
    if (!nextOpen) {
      setLinksText("");
      setPreviewData(null);
      setInvalidNote(null);
      setIsDragging(false);
    }
    setIsOpen(nextOpen);
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksText.trim()) {
      toast.error("Please paste at least one URL");
      return;
    }

    setIsSubmitting(true);
    setInvalidNote(null);
    try {
      const res = await createReferencesFromText({ text: linksText });
      if (res.ok) {
        const { results, createdCount, duplicateCount = 0, invalidCount = 0, truncatedCount = 0 } = res.data;
        const failedInputs = results.filter((r) => r.status === "invalid").map((r) => r.input);

        if (createdCount > 0) {
          toast.success(
            `Added ${createdCount} reference${createdCount > 1 ? "s" : ""} to Inbox${
              duplicateCount > 0 ? ` (${duplicateCount} already saved)` : ""
            }${invalidCount > 0 ? ` · ${invalidCount} invalid` : ""}`,
            {
              action: {
                label: "Open Inbox",
                onClick: () => router.push("/inbox"),
              },
            }
          );
        } else if (duplicateCount > 0 && invalidCount === 0) {
          toast.info(`All ${duplicateCount} link${duplicateCount > 1 ? "s are" : " is"} already in your references`);
        }

        if (truncatedCount > 0) {
          toast.warning(`Only the first 50 URLs were processed (${truncatedCount} remaining).`);
        }

        if (failedInputs.length > 0) {
          setLinksText(failedInputs.join("\n"));
          setInvalidNote(
            `${failedInputs.length} URL${failedInputs.length > 1 ? "s" : ""} could not be parsed. Fix or remove them below.`
          );
          if (createdCount === 0) {
            toast.error("No valid supported URLs could be saved");
          }
          return;
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

  const processImportedFile = (file: File) => {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset file input so selecting the same file after fixes still triggers onChange
    e.target.value = "";
    if (!file) return;
    processImportedFile(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (fileLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImportedFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.newCount === 0) return;

    setIsSubmitting(true);
    const newUrls = previewData.items.filter((i) => i.status === "new").map((i) => i.url);

    try {
      const res = await importReferencesFromUrls({ urls: newUrls });
      if (res.ok) {
        toast.success(`Successfully imported ${res.data.created} references to Inbox`, {
          action: {
            label: "Open Inbox",
            onClick: () => router.push("/inbox"),
          },
        });
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
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md rounded-lg border bg-card p-6 shadow-none">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-display">Add References</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Paste links from Instagram, TikTok, YouTube, X, Threads, or upload saved exports.
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
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="add-links-textarea" className="label-mono text-muted-foreground">
                    Post or Video URLs
                  </label>
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      detectedUrlCount > 50 ? "text-warning font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {detectedUrlCount} / 50 per batch
                  </span>
                </div>
                <Textarea
                  id="add-links-textarea"
                  placeholder="Paste URLs (one per line, up to 50 links) or mobile share text..."
                  value={linksText}
                  onChange={(e) => {
                    setLinksText(e.target.value);
                    if (invalidNote) setInvalidNote(null);
                  }}
                  className="min-h-[140px] rounded-md border-input text-xs font-mono leading-relaxed"
                  disabled={isSubmitting}
                />
                {detectedUrlCount > 50 && (
                  <p className="text-[11px] font-mono text-warning flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{detectedUrlCount} links detected — only the first 50 will be processed at once.</span>
                  </p>
                )}
                {invalidNote && (
                  <p role="alert" className="text-[11px] font-mono text-destructive flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{invalidNote}</span>
                  </p>
                )}
                <p className="text-[11px] font-mono text-muted-foreground">
                  Tracking params (utm, igsh, si, etc.) are stripped automatically.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={isSubmitting}
                  className="h-9 rounded-md text-xs font-mono uppercase tracking-wider"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !linksText.trim()}
                  className="h-9 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider font-semibold"
                >
                  {isSubmitting ? "Adding..." : "Add to Inbox"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="file" className="mt-4 space-y-4">
            {!previewData ? (
              <label
                htmlFor="file-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!fileLoading) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`block cursor-pointer border-2 border-dashed rounded-lg p-6 text-center space-y-3 transition-colors focus-within:ring-2 focus-within:ring-ring/40 ${
                  isDragging
                    ? "border-foreground bg-secondary/70"
                    : "border-border bg-muted/40 hover:border-foreground/40"
                }`}
              >
                <div className="mx-auto size-9 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <Upload className="size-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-primary underline underline-offset-4">
                    Select or drop an export file (.json, .html, .txt, .csv)
                  </span>
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
              </label>
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

                {previewData.items.some((i) => i.status === "new") && (
                  <div className="rounded-md border border-border/80 bg-background p-2.5 space-y-1 max-h-32 overflow-y-auto">
                    <div className="label-mono text-muted-foreground pb-0.5">
                      Preview (new links)
                    </div>
                    {previewData.items
                      .filter((i) => i.status === "new")
                      .slice(0, 6)
                      .map((item) => (
                        <div key={item.url} className="text-[11px] font-mono text-foreground truncate flex items-center gap-1.5">
                          <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.url}</span>
                        </div>
                      ))}
                    {previewData.newCount > 6 && (
                      <div className="text-[10px] font-mono text-muted-foreground pt-0.5">
                        +{previewData.newCount - 6} more links ready
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => setPreviewData(null)}
                    className="h-9 text-xs font-mono text-muted-foreground rounded-md"
                  >
                    Upload another file
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => handleDialogOpenChange(false)}
                      className="h-9 rounded-md text-xs font-mono uppercase tracking-wider"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={previewData.newCount === 0 || isSubmitting}
                      onClick={handleConfirmImport}
                      className="h-9 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider font-semibold"
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

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReferenceFromUrl } from "@/lib/actions/references";

export function InboxBookmarkletIngest({ addUrl }: { addUrl?: string }) {
  const router = useRouter();
  const processedRef = React.useRef<string | null>(null);
  const [inFlightUrl, setInFlightUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const trimmed = addUrl?.trim();
    if (!trimmed || processedRef.current === trimmed) return;
    processedRef.current = trimmed;
    let active = true;
    setInFlightUrl(trimmed);

    (async () => {
      const toastId = toast.loading("Saving link from bookmarklet to Inbox...");
      try {
        const res = await createReferenceFromUrl({ input: trimmed });
        if (res.ok) {
          const refId = res.data.id;
          if (res.data.status === "duplicate") {
            toast.info("Reference is already saved in your library.", {
              id: toastId,
              action: {
                label: "Open",
                onClick: () => router.push(`/references/${refId}`),
              },
            });
          } else {
            toast.success("Reference added to Inbox!", {
              id: toastId,
              action: {
                label: "Open",
                onClick: () => router.push(`/references/${refId}`),
              },
            });
          }
        } else {
          toast.error(res.error.message || "Could not save bookmarklet URL.", { id: toastId });
        }
      } catch {
        toast.error("Failed to ingest bookmarklet URL.", { id: toastId });
      } finally {
        if (active) {
          setInFlightUrl(null);
          router.replace("/inbox");
          router.refresh();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [addUrl, router]);

  if (!inFlightUrl) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-secondary/50 text-xs font-mono text-foreground"
    >
      <Loader2 className="size-4 animate-spin shrink-0 text-brand" />
      <span className="truncate">Saving bookmarklet link to Inbox: {inFlightUrl}</span>
    </div>
  );
}

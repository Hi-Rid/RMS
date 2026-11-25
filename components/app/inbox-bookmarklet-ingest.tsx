"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createReferenceFromUrl } from "@/lib/actions/references";

export function InboxBookmarkletIngest({ addUrl }: { addUrl?: string }) {
  const router = useRouter();
  const processedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const trimmed = addUrl?.trim();
    if (!trimmed || processedRef.current === trimmed) return;
    processedRef.current = trimmed;

    (async () => {
      const toastId = toast.loading("Saving link from bookmarklet to Inbox...");
      try {
        const res = await createReferenceFromUrl({ input: trimmed });
        if (res.ok) {
          if (res.data.status === "duplicate") {
            toast.info("Reference is already saved in your library.", { id: toastId });
          } else {
            toast.success("Reference added to Inbox!", { id: toastId });
          }
        } else {
          toast.error(res.error.message || "Could not save bookmarklet URL.", { id: toastId });
        }
      } catch {
        toast.error("Failed to ingest bookmarklet URL.", { id: toastId });
      } finally {
        router.replace("/inbox");
        router.refresh();
      }
    })();
  }, [addUrl, router]);

  return null;
}

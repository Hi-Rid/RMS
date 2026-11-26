import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground flex min-h-16 w-full rounded-control border bg-card px-3 py-2 text-sm transition-[color,box-shadow] outline-none hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-1",
        "aria-invalid:border-destructive aria-invalid:ring-destructive aria-invalid:ring-1",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
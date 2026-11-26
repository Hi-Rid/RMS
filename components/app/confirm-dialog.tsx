"use client";

import * as React from "react";
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
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!isPending ? onOpenChange(next) : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-mono leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isPending}
            className="text-xs font-mono h-8 rounded-md"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={isPending}
            className={
              variant === "destructive"
                ? "text-xs font-mono h-8 rounded-md bg-destructive text-white hover:bg-destructive/90 font-semibold"
                : "text-xs font-mono h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-semibold"
            }
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Working...</span>
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

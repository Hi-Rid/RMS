"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Calendar,
  CheckSquare,
  FilePlus,
  Home,
  Inbox,
  Layers,
  LineChart,
  ListTodo,
  Music,
  PlusCircle,
  Quote,
  Settings,
  Users,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAddLinks?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    Boolean(el.closest('[contenteditable="true"]'))
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenAddLinks,
}: CommandPaletteProps) {
  const router = useRouter();
  const [isMac, setIsMac] = React.useState(false);

  React.useEffect(() => {
    setIsMac(typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  const launchAddLinks = React.useCallback(() => {
    if (onOpenAddLinks) {
      window.setTimeout(onOpenAddLinks, 140);
    } else {
      router.push("/inbox");
    }
  }, [onOpenAddLinks, router]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Toggle on Cmd+K or Ctrl+K (CapsLock safe)
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (open || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) {
        return;
      }

      // Skip global single-key shortcuts while any dialog/sheet is open
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "/") {
        e.preventDefault();
        onOpenChange(true);
      } else if (key === "a" && !e.shiftKey) {
        e.preventDefault();
        if (onOpenAddLinks) onOpenAddLinks();
        else router.push("/inbox");
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        router.push("/contents/new");
      } else if (key === "t" && !e.shiftKey) {
        e.preventDefault();
        router.push("/inbox/triage");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange, onOpenAddLinks, router]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to page or run action..." />
      <CommandList>
        <CommandEmpty>No matching commands or pages found.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem
            value="add links references paste url"
            onSelect={() => runCommand(launchAddLinks)}
          >
            <PlusCircle />
            <span>Add links or references</span>
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="create new content studio"
            onSelect={() => runCommand(() => router.push("/contents/new"))}
          >
            <FilePlus />
            <span>Create new content</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="start triage mode inbox review"
            onSelect={() => runCommand(() => router.push("/inbox/triage"))}
          >
            <ListTodo />
            <span>Start triage mode</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem value="home dashboard" onSelect={() => runCommand(() => router.push("/home"))}>
            <Home />
            <span>Home</span>
          </CommandItem>
          <CommandItem value="inbox queue" onSelect={() => runCommand(() => router.push("/inbox"))}>
            <Inbox />
            <span>Inbox</span>
          </CommandItem>
          <CommandItem value="references library" onSelect={() => runCommand(() => router.push("/references"))}>
            <Bookmark />
            <span>References</span>
          </CommandItem>
          <CommandItem value="contents studio production" onSelect={() => runCommand(() => router.push("/contents"))}>
            <Layers />
            <span>Contents Studio</span>
          </CommandItem>
          <CommandItem value="evaluate metrics checkpoints" onSelect={() => runCommand(() => router.push("/evaluate"))}>
            <CheckSquare />
            <span>Evaluate</span>
          </CommandItem>
          <CommandItem value="planner calendar schedule" onSelect={() => runCommand(() => router.push("/planner"))}>
            <Calendar />
            <span>Planner</span>
          </CommandItem>
          <CommandItem value="audio sound library" onSelect={() => runCommand(() => router.push("/audio"))}>
            <Music />
            <span>Audio</span>
          </CommandItem>
          <CommandItem value="sources creators accounts" onSelect={() => runCommand(() => router.push("/sources"))}>
            <Users />
            <span>Sources</span>
          </CommandItem>
          <CommandItem value="captions hashtags templates" onSelect={() => runCommand(() => router.push("/captions"))}>
            <Quote />
            <span>Captions</span>
          </CommandItem>
          <CommandItem value="analytics insight reports" onSelect={() => runCommand(() => router.push("/insight"))}>
            <LineChart />
            <span>Analytics / Insight</span>
          </CommandItem>
          <CommandItem value="settings preferences api key" onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/80 bg-background px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/80 bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
            Open
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/80">
          {isMac ? "⌘K" : "Ctrl+K"} or /
        </span>
      </div>
    </CommandDialog>
  );
}

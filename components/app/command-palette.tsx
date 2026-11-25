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

export function CommandPalette({
  open,
  onOpenChange,
  onOpenAddLinks,
}: CommandPaletteProps) {
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Toggle on Cmd+K or Ctrl+K
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
        return;
      }

      // Open on "/" when not focused on an input/textarea
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search commands or jump to a page..." />
      <CommandList>
        <CommandEmpty>No matching commands or pages found.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenAddLinks) onOpenAddLinks();
                else router.push("/inbox");
              })
            }
          >
            <PlusCircle />
            <span>Add links or references</span>
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/contents/new"))}>
            <FilePlus />
            <span>Create new content</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/inbox/triage"))}>
            <ListTodo />
            <span>Start triage mode</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/inbox"))}>
            <Inbox />
            <span>Inbox</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/references"))}>
            <Bookmark />
            <span>References</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/contents"))}>
            <Layers />
            <span>Contents</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/evaluate"))}>
            <CheckSquare />
            <span>Evaluate</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/planner"))}>
            <Calendar />
            <span>Planner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/audio"))}>
            <Music />
            <span>Audio library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/sources"))}>
            <Users />
            <span>Source accounts</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/captions"))}>
            <Quote />
            <span>Caption library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/insight"))}>
            <LineChart />
            <span>Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
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
        <span className="font-mono text-[10px] text-muted-foreground/80">Ctrl+K or /</span>
      </div>
    </CommandDialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Calendar,
  CheckSquare,
  FilePlus,
  FolderOpen,
  Home,
  Inbox,
  Layers,
  LineChart,
  ListTodo,
  Music,
  PlusCircle,
  Quote,
  Search,
  Settings,
  Sparkles,
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
      <CommandInput placeholder="Type a command, page, or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                if (onOpenAddLinks) onOpenAddLinks();
                else router.push("/inbox");
              })
            }
          >
            <PlusCircle className="mr-2 size-4" />
            <span>Add links or references</span>
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/contents/new"))}>
            <FilePlus className="mr-2 size-4" />
            <span>Create new content</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/inbox/triage"))}>
            <ListTodo className="mr-2 size-4" />
            <span>Start triage mode</span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home className="mr-2 size-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/inbox"))}>
            <Inbox className="mr-2 size-4" />
            <span>Inbox</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/references"))}>
            <Bookmark className="mr-2 size-4" />
            <span>References</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/contents"))}>
            <Layers className="mr-2 size-4" />
            <span>Contents</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/evaluate"))}>
            <CheckSquare className="mr-2 size-4" />
            <span>Evaluate</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/planner"))}>
            <Calendar className="mr-2 size-4" />
            <span>Planner</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/audio"))}>
            <Music className="mr-2 size-4" />
            <span>Audio library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/sources"))}>
            <Users className="mr-2 size-4" />
            <span>Source accounts</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/captions"))}>
            <Quote className="mr-2 size-4" />
            <span>Caption library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/insight"))}>
            <LineChart className="mr-2 size-4" />
            <span>Insight & analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 size-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

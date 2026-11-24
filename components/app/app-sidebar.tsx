"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Calendar,
  CheckSquare,
  Home,
  Inbox,
  Layers,
  LineChart,
  LogOut,
  Music,
  Plus,
  Quote,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { signOut } from "@/lib/actions/auth";
import type { SidebarCounts } from "@/lib/queries/home";

interface AppSidebarProps {
  counts: SidebarCounts;
  ownerEmail?: string;
  onOpenCommand: () => void;
  onOpenAddLinks: () => void;
}

export function AppSidebar({
  counts,
  ownerEmail = "owner@folio.local",
  onOpenCommand,
  onOpenAddLinks,
}: AppSidebarProps) {
  const pathname = usePathname();

  const isNavActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[240px] shrink-0 border-r border-border bg-sidebar flex flex-col h-screen select-none">
      {/* Brand & Action Header */}
      <div className="p-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono text-xs font-bold tracking-tight">
              F
            </div>
            <span className="font-display font-black text-xl tracking-tight text-foreground">
              Folio
            </span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
            v2.0
          </span>
        </div>

        {/* Prominent "+ Create / Add link" Action Button */}
        <Button
          onClick={onOpenAddLinks}
          className="w-full h-[36px] rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <Plus className="size-4" />
          <span>Add Reference</span>
        </Button>

        {/* Quick Search Bar / Command Palette Trigger */}
        <button
          onClick={onOpenCommand}
          className="w-full h-[32px] rounded-md bg-background border border-border px-2.5 flex items-center justify-between text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Search className="size-3.5" />
            <span className="text-xs">Search & jump...</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/50">
            /
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-5">
          {/* Main Navigation */}
          <div className="space-y-1">
            <NavItem
              href="/"
              icon={<Home className="size-4" />}
              label="Home"
              isActive={isNavActive("/")}
            />
            <NavItem
              href="/inbox"
              icon={<Inbox className="size-4" />}
              label="Inbox"
              count={counts.inbox}
              isActive={isNavActive("/inbox")}
            />
          </div>

          {/* Library & Content */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Content
            </div>
            <NavItem
              href="/references"
              icon={<Bookmark className="size-4" />}
              label="References"
              count={counts.references}
              isActive={isNavActive("/references")}
            />
            <NavItem
              href="/contents"
              icon={<Layers className="size-4" />}
              label="Contents"
              count={counts.contents}
              isActive={isNavActive("/contents")}
            />
            <NavItem
              href="/audio"
              icon={<Music className="size-4" />}
              label="Audio"
              count={counts.audio}
              isActive={isNavActive("/audio")}
            />
            <NavItem
              href="/sources"
              icon={<Users className="size-4" />}
              label="Sources"
              count={counts.sources}
              isActive={isNavActive("/sources")}
            />
          </div>

          {/* Workflow & Ops */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Workflow
            </div>
            <NavItem
              href="/evaluate"
              icon={<CheckSquare className="size-4" />}
              label="Evaluate"
              count={counts.evaluate}
              highlightCount={counts.evaluate > 0}
              isActive={isNavActive("/evaluate")}
            />
            <NavItem
              href="/planner"
              icon={<Calendar className="size-4" />}
              label="Planner"
              isActive={isNavActive("/planner")}
            />
            <NavItem
              href="/captions"
              icon={<Quote className="size-4" />}
              label="Captions"
              count={counts.captions}
              isActive={isNavActive("/captions")}
            />
          </div>

          {/* Insights & Settings */}
          <div className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Insights
            </div>
            <NavItem
              href="/insight"
              icon={<LineChart className="size-4" />}
              label="Insight"
              isActive={isNavActive("/insight")}
            />
            <NavItem
              href="/settings"
              icon={<Settings className="size-4" />}
              label="Settings"
              isActive={isNavActive("/settings")}
            />
          </div>

          {/* Pillars Group (if any active) */}
          {counts.pillars.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border/60">
              <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Pillars
              </div>
              {counts.pillars.map((pillar) => (
                <Link
                  key={pillar.id}
                  href={`/references?pillar=${pillar.slug}`}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <span className="truncate">{pillar.name}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{pillar.count}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Statuses Group */}
          <div className="space-y-1 pt-2 border-t border-border/60 pb-4">
            <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Status
            </div>
            {(
              [
                ["inbox", "Inbox"],
                ["selected", "Selected"],
                ["production", "Production"],
                ["posted", "Posted"],
                ["evaluating", "Evaluating"],
                ["skipped", "Skipped"],
              ] as const
            ).map(([statusKey, label]) => (
              <Link
                key={statusKey}
                href={`/references?status=${statusKey}`}
                className="flex items-center justify-between px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <span>{label}</span>
                <span className="text-[11px] font-mono">
                  {counts.statuses[statusKey] ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* User / Profile card at bottom (matching screenshot style) */}
      <div className="p-3 border-t border-border bg-sidebar">
        <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/80">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="size-7 shrink-0 rounded-md bg-secondary flex items-center justify-center font-mono text-xs font-bold text-foreground">
              {ownerEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-foreground truncate" title={ownerEmail}>
                {ownerEmail}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">Solo Creator</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  count,
  highlightCount,
  isActive,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  highlightCount?: boolean;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-foreground/80 hover:bg-secondary hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded",
            isActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : highlightCount
              ? "bg-destructive/10 text-destructive font-bold"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

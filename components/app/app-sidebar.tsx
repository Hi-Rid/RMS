"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bookmark,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/app/brand-logo";
import { signOut } from "@/lib/actions/auth";
import type { SidebarCounts } from "@/lib/queries/home";

interface AppSidebarProps {
  counts: SidebarCounts;
  ownerEmail?: string;
  onOpenCommand: () => void;
  onOpenAddLinks: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const PIPELINE_STATUSES = [
  ["inbox", "Inbox"],
  ["selected", "Selected"],
  ["production", "Prod"],
  ["posted", "Posted"],
  ["evaluating", "Eval"],
  ["skipped", "Skip"],
] as const;

export function AppSidebar(props: AppSidebarProps) {
  return (
    <React.Suspense fallback={<AppSidebarFrame {...props} activePillar={null} activeStatus={null} />}>
      <AppSidebarWithSearch {...props} />
    </React.Suspense>
  );
}

function AppSidebarWithSearch(props: AppSidebarProps) {
  const searchParams = useSearchParams();
  const activePillar = searchParams.get("pillar");
  const activeStatus = searchParams.get("status");

  return (
    <AppSidebarFrame
      {...props}
      activePillar={activePillar}
      activeStatus={activeStatus}
    />
  );
}

interface AppSidebarFrameProps extends AppSidebarProps {
  activePillar: string | null;
  activeStatus: string | null;
}

function AppSidebarFrame({
  counts,
  ownerEmail = "owner@rms.local",
  onOpenCommand,
  onOpenAddLinks,
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapse,
  activePillar,
  activeStatus,
}: AppSidebarFrameProps) {
  const pathname = usePathname();
  const [pipelineOpen, setPipelineOpen] = React.useState(true);
  const [pillarsOpen, setPillarsOpen] = React.useState(false);
  const [showAllPillars, setShowAllPillars] = React.useState(false);

  React.useEffect(() => {
    if (activePillar) {
      setPillarsOpen(true);
    }
  }, [activePillar]);

  const orderedPillars = React.useMemo(
    () =>
      [...counts.pillars].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return 0;
      }),
    [counts.pillars]
  );

  const nonZeroPillars = React.useMemo(
    () => orderedPillars.filter((p) => p.count > 0 || p.slug === activePillar),
    [orderedPillars, activePillar]
  );

  const visiblePillars = showAllPillars
    ? orderedPillars
    : nonZeroPillars.length > 0
    ? nonZeroPillars.slice(0, 8)
    : orderedPillars.slice(0, 6);

  const isNavActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/references" && pathname === "/references" && (activeStatus || activePillar)) {
      return false;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const totalPipelineRefs =
    (counts.statuses.inbox ?? 0) +
    (counts.statuses.selected ?? 0) +
    (counts.statuses.production ?? 0) +
    (counts.statuses.posted ?? 0) +
    (counts.statuses.evaluating ?? 0) +
    (counts.statuses.skipped ?? 0);

  return (
    <aside
      className={cn(
        "h-full shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col select-none transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-full lg:w-[252px]"
      )}
    >
      {/* Top Brand & Action Header */}
      <div className={cn("p-3.5 pb-2.5 space-y-2.5 border-b border-sidebar-border/70", collapsed && "px-2.5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
          <Link
            href="/"
            onClick={onNavigate}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            <BrandLogo
              className="size-7 shrink-0 transition-transform duration-150 group-hover:scale-105"
              decorative={!collapsed}
            />
            {!collapsed && (
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-display font-black text-lg tracking-tight text-foreground">
                  RMS
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                  v2.0
                </span>
              </div>
            )}
          </Link>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 border border-transparent hover:border-border transition-colors"
            >
              <X className="size-4" />
            </button>
          ) : (
            onToggleCollapse &&
            !collapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="hidden lg:flex size-7 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
            )
          )}
        </div>

        {collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="w-full h-7 rounded-md hidden lg:flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Prominent Add Reference Action Button */}
        <Button
          onClick={() => {
            onClose?.();
            onOpenAddLinks();
          }}
          title="Add Reference"
          className={cn(
            "w-full h-9 rounded-md bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-medium text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5",
            collapsed && "px-0"
          )}
        >
          <Plus className="size-4 shrink-0" />
          {!collapsed && <span>Add Reference</span>}
        </Button>

        {/* Quick Search / Command Palette Trigger */}
        <button
          type="button"
          onClick={() => {
            onClose?.();
            onOpenCommand();
          }}
          title="Search & jump (/)"
          className={cn(
            "w-full h-8 rounded-md bg-background border border-border flex items-center text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors",
            collapsed ? "justify-center px-0" : "justify-between px-2.5"
          )}
        >
          {collapsed ? (
            <Search className="size-3.5" />
          ) : (
            <>
              <span className="flex items-center gap-1.5 truncate">
                <Search className="size-3.5 shrink-0" />
                <span className="truncate">Search &amp; jump...</span>
              </span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/60 shrink-0">
                /
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Scrollable Navigation Regions */}
      <nav
        aria-label="Primary Sidebar Navigation"
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 space-y-4",
          collapsed ? "px-2" : "px-3"
        )}
      >
        {/* Overview */}
        <div className="space-y-0.5">
          <NavItem
            href="/"
            icon={<Home className="size-4" />}
            label="Home"
            isActive={isNavActive("/")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/inbox"
            icon={<Inbox className="size-4" />}
            label="Inbox"
            count={counts.inbox}
            isActive={isNavActive("/inbox")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>

        {/* Library & Content */}
        <div className="space-y-0.5">
          {!collapsed && <SectionLabel label="Library" />}
          <NavItem
            href="/references"
            icon={<Bookmark className="size-4" />}
            label="References"
            count={counts.references}
            isActive={isNavActive("/references")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/contents"
            icon={<Layers className="size-4" />}
            label="Contents"
            count={counts.contents}
            isActive={isNavActive("/contents")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/audio"
            icon={<Music className="size-4" />}
            label="Audio"
            count={counts.audio}
            isActive={isNavActive("/audio")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/sources"
            icon={<Users className="size-4" />}
            label="Sources"
            count={counts.sources}
            isActive={isNavActive("/sources")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>

        {/* Workflow */}
        <div className="space-y-0.5">
          {!collapsed && <SectionLabel label="Workflow" />}
          <NavItem
            href="/evaluate"
            icon={<CheckSquare className="size-4" />}
            label="Evaluate"
            count={counts.evaluate}
            highlightCount={counts.evaluate > 0}
            isActive={isNavActive("/evaluate")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/planner"
            icon={<Calendar className="size-4" />}
            label="Planner"
            isActive={isNavActive("/planner")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/captions"
            icon={<Quote className="size-4" />}
            label="Captions"
            count={counts.captions}
            isActive={isNavActive("/captions")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>

        {/* Analytics & System */}
        <div className="space-y-0.5">
          {!collapsed && <SectionLabel label="System" />}
          <NavItem
            href="/insight"
            icon={<LineChart className="size-4" />}
            label="Insight"
            isActive={isNavActive("/insight")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/settings"
            icon={<Settings className="size-4" />}
            label="Settings"
            isActive={isNavActive("/settings")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>

        {/* Pipeline Status (2-column compact chip grid) */}
        {!collapsed && (
          <div className="pt-2.5 border-t border-sidebar-border/80 space-y-2">
            <button
              type="button"
              onClick={() => setPipelineOpen((prev) => !prev)}
              className="w-full px-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span>Pipeline</span>
                <span className="text-[10px] px-1.5 rounded bg-background border border-border text-foreground tabular-nums">
                  {totalPipelineRefs}
                </span>
              </span>
              {pipelineOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>

            {pipelineOpen && (
              <div className="grid grid-cols-2 gap-1">
                {PIPELINE_STATUSES.map(([statusKey, label]) => {
                  const isStatusActive =
                    pathname === "/references" && activeStatus === statusKey;
                  return (
                    <Link
                      key={statusKey}
                      href={`/references?status=${statusKey}`}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-mono border transition-colors",
                        isStatusActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary font-bold"
                          : "bg-background/70 text-foreground/80 border-border/70 hover:bg-background hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      <span className="truncate">{label}</span>
                      <span
                        className={cn(
                          "text-[10px] tabular-nums ml-1",
                          isStatusActive ? "text-sidebar-primary-foreground/90" : "text-muted-foreground"
                        )}
                      >
                        {counts.statuses[statusKey] ?? 0}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pillars Collapsible Accordion */}
        {!collapsed && orderedPillars.length > 0 && (
          <div className="pt-2.5 border-t border-sidebar-border/80 space-y-1.5 pb-2">
            <button
              type="button"
              onClick={() => setPillarsOpen((prev) => !prev)}
              className="w-full px-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span>Pillars</span>
                <span className="text-[10px] px-1.5 rounded bg-background border border-border text-foreground tabular-nums">
                  {orderedPillars.length}
                </span>
              </span>
              {pillarsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>

            {pillarsOpen && (
              <div className="space-y-1">
                {visiblePillars.map((pillar) => {
                  const isPillarActive =
                    pathname === "/references" && activePillar === pillar.slug;
                  return (
                    <Link
                      key={pillar.id}
                      href={`/references?pillar=${pillar.slug}`}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                        isPillarActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                          : "text-foreground/80 hover:bg-background/80 hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{pillar.name}</span>
                      <span
                        className={cn(
                          "text-[10px] font-mono tabular-nums",
                          isPillarActive ? "text-sidebar-primary-foreground/85" : "text-muted-foreground"
                        )}
                      >
                        {pillar.count}
                      </span>
                    </Link>
                  );
                })}

                {orderedPillars.length > visiblePillars.length || showAllPillars ? (
                  <button
                    type="button"
                    onClick={() => setShowAllPillars((prev) => !prev)}
                    className="w-full text-left px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAllPillars
                      ? "Show used only"
                      : `+ Show all ${orderedPillars.length} pillars`}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Bottom User Profile Card */}
      <div className={cn("p-3 border-t border-sidebar-border bg-sidebar shrink-0", collapsed && "p-2")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={ownerEmail}
              className="size-8 rounded-md bg-background border border-border flex items-center justify-center font-mono text-xs font-bold text-foreground"
            >
              {ownerEmail.slice(0, 2).toUpperCase()}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background border border-transparent hover:border-border transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/90 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 shrink-0 rounded-md bg-secondary border border-border/70 flex items-center justify-center font-mono text-xs font-bold text-foreground">
                {ownerEmail.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground truncate" title={ownerEmail}>
                  {ownerEmail}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">Solo Creator</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-2.5 pb-1 pt-0.5 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  count,
  highlightCount,
  isActive,
  collapsed = false,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  highlightCount?: boolean;
  isActive: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center rounded-md text-xs font-medium transition-colors min-h-[34px]",
        collapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          : "text-foreground/80 hover:bg-background/80 hover:text-foreground"
      )}
    >
      <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-2.5")}>
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {!collapsed && typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums ml-2 shrink-0",
            isActive
              ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
              : highlightCount
              ? "bg-destructive/15 text-destructive font-bold"
              : "bg-background/90 border border-border/70 text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}

      {collapsed && highlightCount && (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
      )}
    </Link>
  );
}

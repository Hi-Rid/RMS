"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  CheckSquare,
  Home,
  Inbox,
  Layers,
  Menu,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BrandLogo } from "@/components/app/brand-logo";
import { CommandPalette } from "@/components/app/command-palette";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import type { SidebarCounts } from "@/lib/queries/home";

interface AppShellProps {
  counts: SidebarCounts;
  ownerEmail?: string;
  children: React.ReactNode;
}

const MOBILE_ROUTE_LABELS: [string, string][] = [
  ["/inbox/triage", "Inbox Triage"],
  ["/inbox", "Inbox"],
  ["/references", "References"],
  ["/contents/new", "New Content"],
  ["/contents", "Contents"],
  ["/audio", "Audio"],
  ["/sources", "Sources"],
  ["/evaluate", "Evaluate"],
  ["/planner", "Planner"],
  ["/captions", "Captions"],
  ["/insight", "Insight"],
  ["/settings", "Settings"],
];

export function AppShell({ counts, ownerEmail, children }: AppShellProps) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [addLinksOpen, setAddLinksOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  const currentPageLabel = React.useMemo(() => {
    if (pathname === "/home") return "Home";
    for (const [prefix, label] of MOBILE_ROUTE_LABELS) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label;
    }
    return "RMS";
  }, [pathname]);

  const hasAlerts = counts.inbox > 0 || counts.evaluate > 0;

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      {/* Desktop Floating Sidebar (visible on lg+) */}
      <div className="hidden lg:flex shrink-0 h-full p-2.5 pr-0">
        <AppSidebar
          counts={counts}
          ownerEmail={ownerEmail}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onOpenCommand={() => setCommandOpen(true)}
          onOpenAddLinks={() => setAddLinksOpen(true)}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        {/* Mobile & Tablet Top Bar (< lg) */}
        <header className="lg:hidden h-14 border-b border-border bg-card px-3.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  className="relative size-9 shrink-0 rounded-md flex items-center justify-center border border-border bg-background hover:bg-secondary text-foreground transition-colors"
                >
                  <Menu className="size-4" />
                  {hasAlerts && (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                showCloseButton={false}
                className="p-0 w-[280px] max-w-[85vw] border-r border-border bg-sidebar shadow-none"
              >
                <SheetTitle className="sr-only">RMS Navigation Menu</SheetTitle>
                <AppSidebar
                  counts={counts}
                  ownerEmail={ownerEmail}
                  onNavigate={() => setMobileMenuOpen(false)}
                  onClose={() => setMobileMenuOpen(false)}
                  onOpenCommand={() => {
                    setMobileMenuOpen(false);
                    setCommandOpen(true);
                  }}
                  onOpenAddLinks={() => {
                    setMobileMenuOpen(false);
                    setAddLinksOpen(true);
                  }}
                />
              </SheetContent>
            </Sheet>

            <Link href="/home" className="flex items-center gap-2 min-w-0">
              <BrandLogo className="size-7" />
              <span className="font-display font-black text-base tracking-tight text-foreground">
                RMS
              </span>
            </Link>

            <span className="hidden sm:inline-block text-xs font-mono text-muted-foreground border-l border-border pl-2.5 truncate">
              {currentPageLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Quick search"
              className="size-8 rounded-md flex items-center justify-center border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="size-3.5" />
            </button>
            <Button
              size="sm"
              onClick={() => setAddLinksOpen(true)}
              className="h-8 rounded-md bg-primary text-primary-foreground font-mono text-[11px] uppercase tracking-wider px-2.5"
            >
              <Plus className="size-3.5 mr-1" />
              <span>Add</span>
            </Button>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] w-full">
          {children}
        </main>

        {/* Mobile Bottom Quick Navigation (< md) */}
        <nav
          aria-label="Mobile Quick Navigation"
          className="md:hidden shrink-0 h-14 border-t border-border bg-card grid grid-cols-5 items-stretch"
        >
          <MobileTab
            href="/home"
            label="Home"
            icon={<Home className="size-4" />}
            active={pathname === "/home"}
          />
          <MobileTab
            href="/inbox"
            label="Inbox"
            icon={<Inbox className="size-4" />}
            badge={counts.inbox}
            active={pathname === "/inbox" || pathname.startsWith("/inbox/")}
          />
          <MobileTab
            href="/references"
            label="Refs"
            icon={<Bookmark className="size-4" />}
            active={pathname === "/references" || pathname.startsWith("/references/")}
          />
          <MobileTab
            href="/contents"
            label="Studio"
            icon={<Layers className="size-4" />}
            active={pathname === "/contents" || pathname.startsWith("/contents/")}
          />
          <MobileTab
            href="/evaluate"
            label="Evaluate"
            icon={<CheckSquare className="size-4" />}
            badge={counts.evaluate}
            highlightBadge={counts.evaluate > 0}
            active={pathname === "/evaluate"}
          />
        </nav>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenAddLinks={() => setAddLinksOpen(true)}
      />

      {/* Quick Add Links Modal */}
      <AddLinksDialog open={addLinksOpen} onOpenChange={setAddLinksOpen} />
    </div>
  );
}

function MobileTab({
  href,
  label,
  icon,
  badge,
  highlightBadge,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  highlightBadge?: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-mono transition-colors",
        active ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && <span className="absolute top-0 inset-x-4 h-0.5 bg-foreground rounded-b" />}
      <div className="relative">
        {icon}
        {typeof badge === "number" && badge > 0 && (
          <span
            className={cn(
              "absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-mono font-bold flex items-center justify-center tabular-nums",
              highlightBadge
                ? "bg-destructive text-primary-foreground"
                : "bg-foreground text-background"
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span>{label}</span>
    </Link>
  );
}

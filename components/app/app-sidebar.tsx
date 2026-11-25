"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Calendar,
  CheckSquare,
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

export function AppSidebar({
  counts,
  ownerEmail = "owner@rms.local",
  onOpenCommand,
  onOpenAddLinks,
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();
  const isMobileDrawer = Boolean(onClose);

  const isNavActive = (href: string) => {
    if (href === "/home") return pathname === "/home";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const displayHandle = React.useMemo(() => {
    const raw = ownerEmail.split("@")[0] || "Creator";
    return raw;
  }, [ownerEmail]);

  const initials = React.useMemo(() => {
    const clean = ownerEmail.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "RM";
    return clean.slice(0, 2).toUpperCase();
  }, [ownerEmail]);

  return (
    <aside
      className={cn(
        "h-full shrink-0 bg-card flex flex-col select-none transition-[width] duration-200 overflow-hidden",
        isMobileDrawer ? "w-full" : "rounded-2xl border border-border/80",
        !isMobileDrawer && (collapsed ? "w-[68px]" : "w-[248px]")
      )}
    >
      {/* Top Brand & Primary CTA */}
      <div className={cn("p-3.5 pb-3 space-y-3 shrink-0", collapsed && "px-2.5")}>
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-between gap-2 px-1"
          )}
        >
          <Link
            href="/home"
            onClick={onNavigate}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            <BrandLogo
              className="size-7 shrink-0 transition-transform duration-150 group-hover:scale-105"
              decorative={!collapsed}
            />
            {!collapsed && (
              <span className="font-display font-black text-lg tracking-tight text-foreground">
                RMS
              </span>
            )}
          </Link>

          {!collapsed && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenCommand();
                }}
                title="Quick search (/)"
                aria-label="Quick search"
                className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <Search className="size-4" />
              </button>

              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                >
                  <X className="size-4" />
                </button>
              ) : (
                onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                    className="hidden lg:flex size-7 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {collapsed && onToggleCollapse && (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="w-full h-7 rounded-lg hidden lg:flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}

        {/* Prominent Primary CTA */}
        <Button
          onClick={() => {
            onClose?.();
            onOpenAddLinks();
          }}
          title="Add Reference"
          className={cn(
            "w-full h-10 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium text-[13px] flex items-center justify-center gap-2 shadow-none",
            collapsed && "px-0"
          )}
        >
          <Plus className="size-4 shrink-0" />
          {!collapsed && <span>Add reference</span>}
        </Button>

        {collapsed && (
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onOpenCommand();
            }}
            title="Search & jump (/)"
            aria-label="Search & jump"
            className="w-full h-9 rounded-xl border border-border/80 bg-background/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Search className="size-4" />
          </button>
        )}
      </div>

      {/* Scrollable Navigation Regions */}
      <nav
        aria-label="Primary Sidebar Navigation"
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overscroll-contain pb-3 space-y-4",
          collapsed ? "px-2" : "px-3 [scrollbar-gutter:stable]"
        )}
      >
        {/* Overview */}
        <div className="space-y-0.5">
          <NavItem
            href="/home"
            icon={<Home className="size-4" />}
            label="Home"
            isActive={isNavActive("/home")}
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

        {/* Content & Library */}
        <div className="space-y-0.5">
          {!collapsed && <SectionLabel label="Library" />}
          <NavItem
            href="/references"
            icon={<Bookmark className="size-4" />}
            label="References"
            isActive={isNavActive("/references")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/contents"
            icon={<Layers className="size-4" />}
            label="Contents"
            isActive={isNavActive("/contents")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/audio"
            icon={<Music className="size-4" />}
            label="Audio"
            isActive={isNavActive("/audio")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
          <NavItem
            href="/sources"
            icon={<Users className="size-4" />}
            label="Sources"
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
            isActive={isNavActive("/captions")}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        </div>

        {/* Insights & System */}
        <div className="space-y-0.5">
          {!collapsed && <SectionLabel label="Insights" />}
          <NavItem
            href="/insight"
            icon={<LineChart className="size-4" />}
            label="Analytics"
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
      </nav>

      {/* Bottom User Profile */}
      <div
        className={cn(
          "p-3 pt-2.5 border-t border-border/60 shrink-0",
          collapsed && "p-2"
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={ownerEmail}
              className="size-8 rounded-full bg-[#800115]/10 text-[#800115] flex items-center justify-center text-xs font-semibold"
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary/80 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-secondary/50 transition-colors gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 shrink-0 rounded-full bg-[#800115]/10 text-[#800115] flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-medium text-foreground truncate" title={ownerEmail}>
                  {displayHandle}
                </div>
                <div className="text-[11px] text-muted-foreground truncate" title={ownerEmail}>
                  {ownerEmail}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-background transition-colors shrink-0"
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
    <div className="px-3 pb-1 pt-0.5 text-[11px] font-medium text-muted-foreground/80">
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
        "relative flex items-center rounded-xl text-[13px] transition-colors min-h-[36px]",
        collapsed ? "justify-center px-0 py-1.5" : "justify-between px-3 py-1.5",
        isActive
          ? "bg-[#800115]/[0.07] text-[#800115] font-semibold"
          : "text-muted-foreground font-medium hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-3")}>
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {!collapsed && typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "text-[11px] font-mono px-1.5 py-0.5 rounded-md tabular-nums ml-2 shrink-0",
            highlightCount
              ? "bg-[#800115]/10 text-[#800115] font-semibold"
              : "bg-background border border-border/80 text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}

      {collapsed && highlightCount && (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[#800115]" />
      )}
    </Link>
  );
}

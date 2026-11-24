"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app/app-sidebar";
import { CommandPalette } from "@/components/app/command-palette";
import { AddLinksDialog } from "@/components/app/add-links-dialog";
import type { SidebarCounts } from "@/lib/queries/home";

interface AppShellProps {
  counts: SidebarCounts;
  ownerEmail?: string;
  children: React.ReactNode;
}

export function AppShell({ counts, ownerEmail, children }: AppShellProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [addLinksOpen, setAddLinksOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar (visible on lg+) */}
      <div className="hidden lg:flex shrink-0">
        <AppSidebar
          counts={counts}
          ownerEmail={ownerEmail}
          onOpenCommand={() => setCommandOpen(true)}
          onOpenAddLinks={() => setAddLinksOpen(true)}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Top Bar (< lg) */}
        <header className="lg:hidden h-14 border-b border-border bg-background px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Open navigation menu"
                  className="size-9 rounded-md flex items-center justify-center hover:bg-secondary text-foreground"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[240px] border-r border-border bg-sidebar">
                <AppSidebar
                  counts={counts}
                  ownerEmail={ownerEmail}
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

            <Link href="/" className="font-display font-black text-lg tracking-tight">
              RMS
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommandOpen(true)}
              aria-label="Quick search"
              className="size-8 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
            <Button
              size="sm"
              onClick={() => setAddLinksOpen(true)}
              className="h-8 rounded-md bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider px-3"
            >
              <Plus className="size-3.5 mr-1" />
              <span>Add</span>
            </Button>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenAddLinks={() => setAddLinksOpen(true)}
      />

      {/* Global Add Links Dialog */}
      <AddLinksDialog
        open={addLinksOpen}
        onOpenChange={setAddLinksOpen}
      />
    </div>
  );
}

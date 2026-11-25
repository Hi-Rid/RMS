import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageOwner } from "@/lib/auth/owner";
import { getSidebarCounts } from "@/lib/queries/home";
import { AppShell } from "@/components/app/app-shell";
import { BrandLogo } from "@/components/app/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/app/(app)/dashboard-skeleton";

export const instant = false;

function AppShellFallback() {
  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      <aside className="hidden lg:flex w-[252px] shrink-0 border-r border-sidebar-border bg-sidebar flex-col p-3.5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-sidebar-border/70">
          <BrandLogo className="size-7" />
          <span className="font-display font-black text-lg tracking-tight text-foreground">
            RMS
          </span>
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        <header className="lg:hidden h-14 border-b border-border bg-card px-3.5 flex items-center gap-2.5 shrink-0">
          <BrandLogo className="size-7" />
          <span className="font-display font-black text-base tracking-tight text-foreground">
            RMS
          </span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <DashboardSkeleton />
        </main>
      </div>
    </div>
  );
}

async function AuthenticatedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const [owner, counts] = await Promise.all([
    requirePageOwner(),
    getSidebarCounts(),
  ]);

  return (
    <AppShell counts={counts} ownerEmail={owner.email}>
      {children}
    </AppShell>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}

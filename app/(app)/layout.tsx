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
      <div className="hidden lg:flex shrink-0 h-full p-2.5 pr-0">
        <aside className="w-[248px] h-full rounded-2xl border border-border/80 bg-card flex flex-col p-3.5 space-y-4">
          <div className="flex items-center gap-2.5 px-1 pb-1">
            <BrandLogo className="size-7" />
            <span className="font-display font-black text-lg tracking-tight text-foreground">
              RMS
            </span>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-1.5 pt-1">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-8 w-full rounded-xl" />
            ))}
          </div>
        </aside>
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-dvh overflow-hidden">
        <header className="lg:hidden h-14 border-b border-border bg-card px-3.5 flex items-center gap-2.5 shrink-0">
          <BrandLogo className="size-7" />
          <span className="font-display font-black text-base tracking-tight text-foreground">
            RMS
          </span>
        </header>
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
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

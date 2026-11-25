import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageOwner } from "@/lib/auth/owner";
import { getSidebarCounts } from "@/lib/queries/home";
import { AppShell } from "@/components/app/app-shell";

export const instant = false;

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
    <Suspense
      fallback={
        <div className="flex h-dvh w-full bg-background">
          <div className="hidden lg:block w-[252px] shrink-0 border-r border-sidebar-border bg-sidebar" />
          <div className="flex-1" />
        </div>
      }
    >
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}

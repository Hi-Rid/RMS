import { requirePageOwner } from "@/lib/auth/owner";
import { getSidebarCounts } from "@/lib/queries/home";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

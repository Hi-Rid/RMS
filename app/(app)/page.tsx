import * as React from "react";
import { Suspense } from "react";
import { getHomeData } from "@/lib/queries/home";
import { getOwner } from "@/lib/auth/owner";
import { DashboardView } from "@/app/(app)/dashboard-view";
import { DashboardSkeleton } from "@/app/(app)/dashboard-skeleton";

async function DashboardContent() {
  const [data, owner] = await Promise.all([
    getHomeData(),
    getOwner(),
  ]);

  return <DashboardView data={data} ownerEmail={owner?.email} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

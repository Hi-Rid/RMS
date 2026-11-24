import { getHomeData } from "@/lib/queries/home";
import { getOwner } from "@/lib/auth/owner";
import { DashboardView } from "@/app/(app)/dashboard-view";

export default async function HomePage() {
  const [data, owner] = await Promise.all([
    getHomeData(),
    getOwner(),
  ]);

  return <DashboardView data={data} ownerEmail={owner?.email} />;
}

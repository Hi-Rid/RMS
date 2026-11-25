import { Suspense } from "react";
import { getOwner } from "@/lib/auth/owner";
import { LandingPage } from "@/components/landing/landing-page";

async function LandingWithAuthState() {
  const owner = await getOwner().catch(() => null);
  return (
    <LandingPage
      isAuthenticated={Boolean(owner)}
      ownerEmail={owner?.email}
    />
  );
}

export default function RootLandingPage() {
  return (
    <Suspense fallback={<LandingPage isAuthenticated={false} />}>
      <LandingWithAuthState />
    </Suspense>
  );
}

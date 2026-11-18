import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="label-mono text-muted-foreground">RMS · Phase 0</div>
      <h1 className="text-display">RMS</h1>
      <p className="max-w-md text-muted-foreground">
        Project scaffolding is live. Features arrive starting from P1.
      </p>
      <Button asChild>
        <Link href="/dev/ui">Open design tokens playground</Link>
      </Button>
    </main>
  );
}
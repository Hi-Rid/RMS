"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";

interface AuthShellProps {
  children: React.ReactNode;
  footerText?: string;
}

export function AuthShell({ children, footerText }: AuthShellProps) {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center space-y-1">
          <BrandLogo className="inline-block size-12 mb-2" />
          <h1 className="text-3xl font-black tracking-tight text-foreground font-display">
            RMS
          </h1>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Reference Management &amp; Content Studio
          </p>
        </div>

        {!hasSupabaseConfig && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-mono text-foreground flex items-start gap-2.5">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-bold">Supabase Auth Not Configured</div>
              <p className="text-[11px] text-muted-foreground">
                Add{" "}
                <code className="px-1 py-0.5 rounded bg-background border border-border">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{" "}
                and{" "}
                <code className="px-1 py-0.5 rounded bg-background border border-border">
                  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                </code>{" "}
                to{" "}
                <code className="px-1 py-0.5 rounded bg-background border border-border">
                  .env.local
                </code>{" "}
                to enable sign in and registration.
              </p>
            </div>
          </div>
        )}

        {children}

        {footerText && (
          <p className="text-center text-[11px] font-mono tracking-wider text-muted-foreground">
            {footerText}
          </p>
        )}
      </div>
    </div>
  );
}

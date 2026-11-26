"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";

interface AuthShellProps {
  children: React.ReactNode;
  mode?: "login" | "register";
  footerText?: string;
}

const WORKFLOW_HIGHLIGHTS = [
  {
    code: "01",
    tag: "CAPTURE",
    title: "Save Inspiration Anywhere",
    detail: "iOS Share Sheet, bookmarklet, or batch paste straight to Inbox.",
    icon: Share2,
  },
  {
    code: "02",
    tag: "BREAKDOWN",
    title: "AI Reference & Script Lab",
    detail: "Extract hooks, pacing cues, and persona-aligned shoot drafts.",
    icon: Sparkles,
  },
  {
    code: "03",
    tag: "EVALUATE",
    title: "24h · 7d · 30d Outliers",
    detail: "Track post checkpoints and double down on winning formats.",
    icon: TrendingUp,
  },
];

export function AuthShell({ children, mode = "login", footerText }: AuthShellProps) {
  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  const isRegister = mode === "register";

  return (
    <div className="relative isolate flex min-h-dvh w-full flex-col bg-background text-foreground overflow-x-clip">
      {/* Subtle Architectural Blueprint Dot Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.38]"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 w-full border-b border-border/70 bg-background/90 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandLogo className="size-6 transition-transform duration-150 group-hover:scale-105" />
            <span className="font-display font-black text-base tracking-tight text-foreground">
              RMS
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-card text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Reference Management System
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-secondary/70"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Overview</span>
          </Link>
        </div>
      </header>

      {/* Main Split Editorial Layout */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-8 lg:py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Desktop Editorial Panel (Hidden on small viewports to keep form above the fold) */}
          <aside className="hidden lg:flex lg:col-span-6 flex-col space-y-7 pr-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-brand/30 bg-brand/[0.06]">
                <span className="size-2 rounded-[2px] bg-brand" />
                <span className="label-mono text-brand">
                  {isRegister ? "NEW WORKSPACE SETUP" : "CREATOR STUDIO GATEWAY"}
                </span>
              </div>

              <h1 className="text-4xl xl:text-[2.75rem] font-black font-display tracking-tight leading-[1.02] text-foreground">
                {isRegister ? (
                  <>
                    Build your <span className="text-brand">creative library</span> once.
                  </>
                ) : (
                  <>
                    Ship deliberately.{" "}
                    <span className="text-brand">Not randomly.</span>
                  </>
                )}
              </h1>

              <p className="text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed max-w-md">
                {isRegister
                  ? "Set up your private RMS vault to triage references, draft scripts with your brand persona, and measure growth across checkpoints."
                  : "Pick up right where your production slate left off—triage raw saves, adapt hooks in Studio, and review outlier metrics."}
              </p>
            </div>

            <div className="space-y-2.5 max-w-md">
              {WORKFLOW_HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.code}
                    className="rounded-lg border border-border bg-card p-3.5 flex items-start gap-3"
                  >
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="size-4 text-brand" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-brand font-bold tracking-widest">
                          {item.code} · {item.tag}
                        </span>
                      </div>
                      <div className="text-xs font-display font-bold text-foreground">
                        {item.title}
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground pt-1">
              <span>Asia/Jakarta WIB</span>
              <span>·</span>
              <span>AES-256 Encrypted BYOK</span>
              <span>·</span>
              <span>Full JSON Backup</span>
            </div>
          </aside>

          {/* Right Form Container */}
          <section className="col-span-1 lg:col-span-6 flex flex-col items-center lg:items-end justify-center">
            <div className="w-full max-w-[420px] space-y-4">
              {/* Mobile Brand Identity Header (< lg) */}
              <div className="lg:hidden text-center space-y-1 pb-1">
                <h1 className="text-2xl font-black tracking-tight text-foreground font-display">
                  {isRegister ? "Join RMS Studio" : "RMS Studio"}
                </h1>
                <p className="label-mono text-muted-foreground">
                  Reference Management System
                </p>
              </div>

              {!hasSupabaseConfig && (
                <div
                  role="alert"
                  className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-xs font-mono text-foreground flex items-start gap-2.5"
                >
                  <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-relaxed">
                    <div className="font-bold">Supabase Auth Not Configured</div>
                    <p className="text-[11px] text-muted-foreground">
                      Add{" "}
                      <code className="px-1 py-0.5 rounded bg-card border border-border">
                        NEXT_PUBLIC_SUPABASE_URL
                      </code>{" "}
                      and{" "}
                      <code className="px-1 py-0.5 rounded bg-card border border-border">
                        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                      </code>{" "}
                      to{" "}
                      <code className="px-1 py-0.5 rounded bg-card border border-border">
                        .env.local
                      </code>{" "}
                      to enable authentication.
                    </p>
                  </div>
                </div>
              )}

              {children}

              {footerText && (
                <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground pt-1">
                  {footerText}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Cpu,
  Film,
  Inbox,
  Layers,
  LineChart,
  Music,
  Play,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LandingPageProps {
  isAuthenticated: boolean;
  ownerEmail?: string;
}

type DemoAgentMode = "inbox" | "selected" | "auto_draft";

const AGENT_MODE_DEMOS: Record<
  DemoAgentMode,
  {
    label: string;
    badge: string;
    headline: string;
    description: string;
    statusOutput: string;
    previewTitle: string;
    previewTags: string[];
    steps: { title: string; detail: string }[];
  }
> = {
  inbox: {
    label: "Inbox Review",
    badge: "QUEUE · FAST TRIAGE",
    headline: "AI enriches first, you approve in 2 seconds.",
    description:
      "Every shared link arrives pre-filled with social metadata, 3-second hook, summary, pillars, and visual breakdown—ready for keyboard triage.",
    statusOutput: "inbox · enriched · ready for A / R / S",
    previewTitle: "Clean Lighting Reveal · 3s Visual Hook",
    previewTags: ["storytelling", "lighting", "hook:pattern-interrupt"],
    steps: [
      {
        title: "Social Metadata Synced",
        detail: "@creator.id · Cover frame · Caption & sound captured",
      },
      {
        title: "AI Breakdown Populated",
        detail: "Opening hook, visual pacing notes, format & content pillars",
      },
      {
        title: "Queued in Triage Inbox",
        detail: "Approve (A), Save Reference (R), or Skip (S) from keyboard",
      },
    ],
  },
  selected: {
    label: "Auto-Select",
    badge: "CURATED · ZERO FRICTION",
    headline: "Skip inbox triage for your best inspiration.",
    description:
      "Links you share are enriched with your Creator Persona and promoted straight into your Selected vault so they are ready whenever you plan shoots.",
    statusOutput: "selected · persona-matched · vault indexed",
    previewTitle: "POV Creator Desk Setup & Pacing Loop",
    previewTags: ["b-roll", "desk-setup", "pillar:workflow"],
    steps: [
      {
        title: "Creator Persona Applied",
        detail: "Tailored framing angle aligned with your niche & audience",
      },
      {
        title: "Replicable Elements Tagged",
        detail: "Hook · Visual Framing · Audio Sync indexed cleanly",
      },
      {
        title: "Auto-Promoted to Selected",
        detail: "Ready in your Reference Vault & Content creation links",
      },
    ],
  },
  auto_draft: {
    label: "Full Auto Draft",
    badge: "AUTONOMOUS · END-TO-END",
    headline: "Share one video. Get a complete Content draft.",
    description:
      "Your AI Content Agent enriches the reference AND spawns a brand-new Content card in Studio with an adapted hook, 45–60s script, caption, and checklist.",
    statusOutput: "production · script & checklist spawned",
    previewTitle: "Why 90% of Hooks Lose Viewers in 2 Seconds",
    previewTags: ["full-script", "checklist:6", "ready-to-shoot"],
    steps: [
      {
        title: "Reference Linked as Inspiration #1",
        detail: "Full visual notes & hook breakdown attached automatically",
      },
      {
        title: "Adapted Script & Caption Generated",
        detail: "[HOOK] + [BODY BEATS] + [VISUAL CUES] + [CAPTION]",
      },
      {
        title: "Production Checklist Ready",
        detail: "6 actionable steps waiting inside your Studio board",
      },
    ],
  },
};

export function LandingPage({ isAuthenticated, ownerEmail }: LandingPageProps) {
  const [demoMode, setDemoMode] = React.useState<DemoAgentMode>("auto_draft");
  const [shareSimulated, setShareSimulated] = React.useState(false);
  const [demoChecks, setDemoChecks] = React.useState<boolean[]>([true, true, false]);
  const [demoTriageState, setDemoTriageState] = React.useState<"Approve" | "Save Ref" | "Skip" | null>(
    "Save Ref"
  );

  const activeDemo = AGENT_MODE_DEMOS[demoMode];
  const primaryAppHref = isAuthenticated ? "/home" : "/login?next=/home";

  const toggleCheck = (idx: number) => {
    setDemoChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${targetId}`);
    }
  };

  return (
    <div className="min-h-dvh w-full bg-background text-foreground flex flex-col overflow-x-clip">
      {/* 1. Fixed Editorial Header */}
      <header className="fixed top-0 inset-x-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <BrandLogo className="size-7 transition-transform duration-150 group-hover:scale-105" />
            <span className="font-display font-black text-lg tracking-tight text-foreground">
              RMS
            </span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md border border-border bg-card text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Reference Management System
            </span>
          </Link>

          <nav
            aria-label="Landing Navigation"
            className="hidden md:flex items-center gap-1"
          >
            {[
              { href: "#workflow", id: "workflow", label: "Workflow" },
              { href: "#agent", id: "agent", label: "AI Agent" },
              { href: "#system", id: "system", label: "Modules" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => scrollToSection(e, item.id)}
                className="px-3 py-1.5 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <>
                {ownerEmail && (
                  <span className="hidden lg:inline-block text-[11px] font-mono text-muted-foreground mr-1">
                    {ownerEmail}
                  </span>
                )}
                <Link href="/home">
                  <Button
                    size="sm"
                    className="h-8 rounded-md bg-[#800115] hover:bg-[#690111] text-white font-mono text-xs font-semibold gap-1.5 px-3.5"
                  >
                    <span>Open System</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login?next=/home"
                  className="px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link href="/register?next=/home">
                  <Button
                    size="sm"
                    className="h-8 rounded-md bg-foreground text-background hover:bg-foreground/90 font-mono text-xs font-semibold gap-1.5 px-3.5"
                  >
                    <span>Enter System</span>
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* 2. Signature V1 Editorial Hero (Warm Paper + Crimson Display RMS + Orbiting Workflow Cards) */}
        <section className="relative border-b border-border/80 overflow-hidden">
          {/* Subtle PRD Architectural Blueprint Dot Grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-8 sm:pb-12">
            {/* Centered Outlined Tag Strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 pb-4 sm:pb-6">
              {[
                "Capture",
                "AI Enrich",
                "Breakdown",
                "Studio",
                "Planner",
                "Outliers",
              ].map((pill) => (
                <span
                  key={pill}
                  className="px-3 py-1 rounded-md border border-border bg-card text-[11px] font-mono text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                >
                  {pill}
                </span>
              ))}
            </div>

            {/* Centerpiece Stage with Orbital Cards & Delicate Architectural Connectors */}
            <div className="relative max-w-6xl mx-auto py-4 sm:py-8">
              {/* Hairline Orbital Connectors on Desktop (lg+) */}
              <svg
                aria-hidden="true"
                viewBox="0 0 1100 440"
                fill="none"
                className="hidden lg:block pointer-events-none absolute inset-0 w-full h-full"
              >
                <path
                  d="M 190 95 Q 340 120 445 190"
                  stroke="var(--border)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 910 95 Q 760 120 655 190"
                  stroke="var(--border)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 200 345 Q 350 320 455 255"
                  stroke="var(--border)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                <path
                  d="M 900 345 Q 750 320 645 255"
                  stroke="var(--border)"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
                {/* Corner Architectural Crosshairs */}
                <path d="M295 36 V48 M289 42 H301" stroke="#800115" strokeOpacity="0.45" strokeWidth="1.2" />
                <path d="M805 36 V48 M799 42 H811" stroke="#800115" strokeOpacity="0.45" strokeWidth="1.2" />
                <path d="M295 390 V402 M289 396 H301" stroke="var(--muted-foreground)" strokeOpacity="0.4" strokeWidth="1.2" />
                <path d="M805 390 V402 M799 396 H811" stroke="var(--muted-foreground)" strokeOpacity="0.4" strokeWidth="1.2" />
              </svg>

              {/* Desktop Orbiting Feature Cards */}
              <div className="hidden lg:block">
                {/* Top Left */}
                <div className="absolute left-0 top-2 w-[210px] rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-6 rounded-md bg-[#800115]/10 text-[#800115] flex items-center justify-center">
                      <Share2 className="size-3.5" />
                    </span>
                    <span className="font-display font-bold text-xs text-foreground">
                      1-Tap Mobile Share
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                    Share TikTok, IG &amp; YouTube straight from iOS Share Sheet.
                  </p>
                </div>

                {/* Top Right */}
                <div className="absolute right-0 top-2 w-[210px] rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/40">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-6 rounded-md bg-foreground text-background flex items-center justify-center">
                      <Sparkles className="size-3.5" />
                    </span>
                    <span className="font-display font-bold text-xs text-foreground">
                      AI Content Agent
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                    Auto-fills hook, summary, tags &amp; persona shooting script.
                  </p>
                </div>

                {/* Bottom Left */}
                <div className="absolute left-4 bottom-3 w-[205px] rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-mono text-[#800115]">BREAKDOWN</span>
                    <Wand2 className="size-3.5 text-[#800115]" />
                  </div>
                  <p className="font-display font-bold text-xs text-foreground">
                    Hook &amp; Visual Breakdown
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed mt-0.5">
                    Reverse-engineer pacing before pressing record.
                  </p>
                </div>

                {/* Bottom Right */}
                <div className="absolute right-4 bottom-3 w-[205px] rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-foreground/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-mono text-muted-foreground">EVALUATE LOOP</span>
                    <TrendingUp className="size-3.5 text-foreground" />
                  </div>
                  <p className="font-display font-bold text-xs text-foreground">
                    24h · 7d · 30d Outliers
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground leading-relaxed mt-0.5">
                    Detect what formats actually compound reach.
                  </p>
                </div>
              </div>

              {/* Monumental Crimson RMS® Typography + Separated 3D Props Peeking Around Edges & Gaps */}
              <div className="relative flex flex-col items-center justify-center py-8 sm:py-12">
                <div className="relative inline-flex items-start justify-center select-none">
                  {/* Top-Left of R: Reference Folder + Crimson Bookmark clipped cleanly on upper-left corner */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-7 -top-6 sm:-left-11 sm:-top-9 md:-left-14 md:-top-10 z-20 -rotate-12"
                  >
                    <Image
                      src="/images/hero-prop-folder.png"
                      alt=""
                      width={320}
                      height={436}
                      priority
                      className="w-[54px] sm:w-[82px] md:w-[104px] h-auto object-contain"
                    />
                  </div>

                  {/* Top V-Notch of M: Floating AI Spark Cube peeking above center valley */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[48%] -translate-x-1/2 -top-5 sm:-top-7 md:-top-8 z-20 rotate-12"
                  >
                    <Image
                      src="/images/hero-prop-cube-spark.png"
                      alt=""
                      width={85}
                      height={95}
                      priority
                      className="w-7 sm:w-9 md:w-11 h-auto object-contain"
                    />
                  </div>

                  {/* Top-Right Gap (between M & S): Floating Bookmark Cube */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[68%] -top-4 sm:-top-6 md:-top-7 z-20 -rotate-12"
                  >
                    <Image
                      src="/images/hero-prop-cube-bookmark.png"
                      alt=""
                      width={85}
                      height={92}
                      priority
                      className="w-7 sm:w-9 md:w-11 h-auto object-contain"
                    />
                  </div>

                  {/* GIANT DISPLAY TEXT IN #800115 — Keeps R, M, S crisp & readable */}
                  <h1
                    className="relative z-10 font-display font-black uppercase tracking-[-0.06em] leading-[0.82] text-[#800115] text-center"
                    style={{ fontSize: "clamp(5.6rem, 19vw, 15.8rem)" }}
                  >
                    RMS
                  </h1>
                  <span
                    aria-hidden="true"
                    className="relative z-10 font-display font-black text-[#800115] leading-none ml-1 sm:ml-2 mt-1 sm:mt-2"
                    style={{ fontSize: "clamp(1.6rem, 4.2vw, 3.8rem)" }}
                  >
                    ®
                  </span>

                  {/* Bottom-Left Under R: Floating # Hashtag Cube */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[13%] sm:left-[14%] -bottom-4 sm:-bottom-6 z-20 -rotate-12"
                  >
                    <Image
                      src="/images/hero-prop-cube-hash.png"
                      alt=""
                      width={86}
                      height={95}
                      priority
                      className="w-7 sm:w-9 md:w-11 h-auto object-contain"
                    />
                  </div>

                  {/* Lower Gap Between M & S: Sleek 9:16 Play Reel Card leaning gently across bottom edge */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[63%] sm:left-[64%] -bottom-5 sm:-bottom-7 md:-bottom-9 z-20 rotate-[10deg]"
                  >
                    <Image
                      src="/images/hero-prop-reel.png"
                      alt=""
                      width={193}
                      height={433}
                      priority
                      className="w-[40px] sm:w-[56px] md:w-[70px] h-auto object-contain"
                    />
                  </div>

                  {/* Bottom-Right Hip of S: Charcoal & Cream Studio Clapper */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-6 -bottom-4 sm:-right-10 sm:-bottom-6 md:-right-13 md:-bottom-7 z-20 rotate-12"
                  >
                    <Image
                      src="/images/hero-prop-clapper.png"
                      alt=""
                      width={272}
                      height={448}
                      priority
                      className="w-[54px] sm:w-[80px] md:w-[100px] h-auto object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Concise Subtitle & Centered Action Buttons */}
            <div className="max-w-2xl mx-auto text-center space-y-5 pt-2">
              <p className="text-sm sm:text-base font-mono text-muted-foreground leading-relaxed">
                <strong className="text-foreground font-semibold">
                  Reference Management System
                </strong>{" "}
                — turn daily social media inspiration into structured breakdowns,
                AI-scripted shoots, and measurable outlier growth.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={primaryAppHref}>
                  <Button
                    size="lg"
                    className="h-10 rounded-md bg-foreground text-background hover:bg-foreground/90 font-mono text-xs font-bold uppercase tracking-wider px-6 gap-2"
                  >
                    <span>{isAuthenticated ? "Open System" : "Start Using RMS"}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a href="#workflow">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-10 rounded-md border-border bg-card hover:bg-secondary font-mono text-xs font-semibold px-5 gap-2"
                  >
                    <Play className="size-3.5 text-[#800115]" />
                    <span>See How It Works</span>
                  </Button>
                </a>
              </div>
            </div>

            {/* Responsive Mobile/Tablet Cards Grid (< lg) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-8 lg:hidden">
              {[
                {
                  title: "1-Tap Mobile Share",
                  desc: "Share TikTok, IG & YouTube links directly from iOS Share Sheet.",
                  tag: "INGEST",
                },
                {
                  title: "AI Content Agent",
                  desc: "Auto-fills summary, 3s hook, tags & persona shooting script.",
                  tag: "AGENT",
                },
                {
                  title: "Hook & Visual Breakdown",
                  desc: "Deconstruct pacing, framing & pillars before filming.",
                  tag: "BREAKDOWN",
                },
                {
                  title: "24h · 7d · 30d Eval",
                  desc: "Benchmark checkpoints and spot repeatable outlier patterns.",
                  tag: "OUTLIERS",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg border border-border bg-card p-3.5 space-y-1"
                >
                  <div className="label-mono text-[#800115]">{card.tag}</div>
                  <div className="font-display font-bold text-sm text-foreground">
                    {card.title}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom Corner Editorial Status Bar */}
            <div className="mt-10 sm:mt-14 pt-5 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-[2px] bg-[#800115] shrink-0" />
                <span>
                  <strong className="text-foreground">Latest:</strong> Autonomous AI Content Agent + iOS Share Sheet Ingestion live.
                </span>
              </div>
              <div className="flex items-center gap-4">
                <a href="#workflow" className="hover:text-foreground transition-colors">
                  Workflow
                </a>
                <a href="#agent" className="hover:text-foreground transition-colors">
                  AI Agent
                </a>
                <a href="#system" className="hover:text-foreground transition-colors">
                  Modules
                </a>
                <Link href="/login?next=/home" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Interactive Visual Mini-UI Pipeline (4 Playful Visual Stages) */}
        <section id="workflow" className="scroll-mt-16 border-b border-border/80 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="label-mono text-[#800115]">WHAT IS RMS?</div>
                <h2 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-foreground">
                  From random scroll to shipped content—visually mapped.
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-mono text-muted-foreground max-w-md">
                Click the interactive mini previews below to see how every saved link flows cleanly through the system.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stage 01 Interactive Visual: Share Sheet Capture */}
              <div className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between gap-4 hover:border-foreground/40 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md border border-border bg-secondary text-[10px] font-mono font-bold">
                      01 · CAPTURE
                    </span>
                    <Share2 className="size-4 text-[#800115]" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Save in 1 Tap
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    Send links straight from TikTok, IG, or YouTube Share Sheet.
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>iOS SHARE SHEET</span>
                    <span className="text-[#800115] font-semibold">
                      {shareSimulated ? "INGESTED" : "READY"}
                    </span>
                  </div>
                  <div className="p-2 rounded border border-border/80 bg-card flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono font-semibold text-foreground truncate">
                        tiktok.com/@creator/video
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {shareSimulated ? "Normalized · Deduplicated" : "Tap button to simulate"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShareSimulated((v) => !v)}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors shrink-0",
                        shareSimulated
                          ? "bg-emerald-600 text-white"
                          : "bg-[#800115] text-white hover:bg-[#690111]"
                      )}
                    >
                      {shareSimulated ? "Saved ✓" : "Send"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stage 02 Visual: AI Enrich Card */}
              <div className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between gap-4 hover:border-foreground/40 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md border border-border bg-secondary text-[10px] font-mono font-bold">
                      02 · AI ENRICH
                    </span>
                    <Sparkles className="size-4 text-[#800115]" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Auto-Extracted DNA
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    AI parses social metadata and writes structured breakdown fields.
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>AUTO-FILLED FIELDS</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#800115]/10 text-[#800115] font-semibold">
                      AI
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-semibold text-foreground line-clamp-1">
                    &quot;Stop scrolling if you film talking heads...&quot;
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono">
                      @visual.lab
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#800115] text-white text-[10px] font-mono">
                      Hook: Pattern
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono">
                      Pillar: Craft
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage 03 Interactive Visual: Script & Checklist */}
              <div className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between gap-4 hover:border-foreground/40 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md border border-border bg-secondary text-[10px] font-mono font-bold">
                      03 · STUDIO
                    </span>
                    <Layers className="size-4 text-[#800115]" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Script &amp; Shoot
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    Convert saved hooks into adapted scripts and production checklists.
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>CHECKLIST</span>
                    <span>
                      {demoChecks.filter(Boolean).length}/{demoChecks.length} DONE
                    </span>
                  </div>
                  {["Draft 3s opening hook", "Record B-roll sequence", "Pick trending sound"].map(
                    (item, idx) => {
                      const done = demoChecks[idx];
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleCheck(idx)}
                          className="w-full flex items-center gap-2 text-left text-[11px] font-mono py-1 px-1.5 rounded hover:bg-secondary/60 transition-colors"
                        >
                          <span
                            className={cn(
                              "size-3.5 rounded-[3px] border flex items-center justify-center shrink-0",
                              done
                                ? "bg-[#800115] border-[#800115] text-white"
                                : "border-border bg-card"
                            )}
                          >
                            {done && <Check className="size-2.5" />}
                          </span>
                          <span
                            className={cn(
                              "truncate",
                              done ? "line-through text-muted-foreground" : "text-foreground"
                            )}
                          >
                            {item}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Stage 04 Visual: Outlier Growth Bar Chart */}
              <div className="rounded-lg border border-border bg-card p-5 flex flex-col justify-between gap-4 hover:border-foreground/40 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md border border-border bg-secondary text-[10px] font-mono font-bold">
                      04 · OUTLIERS
                    </span>
                    <LineChart className="size-4 text-[#800115]" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    Measure &amp; Repeat
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    Log 24h, 7d, and 30d checkpoints to isolate winning formulas.
                  </p>
                </div>

                <div className="rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">REACH VELOCITY</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#800115] text-white font-bold">
                      4.8x OUTLIER
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end h-14 pt-1">
                    {[
                      { label: "24h", val: "4.2K", h: "h-4", crimson: false },
                      { label: "7d", val: "68K", h: "h-8", crimson: false },
                      { label: "30d", val: "310K", h: "h-12", crimson: true },
                    ].map((bar) => (
                      <div key={bar.label} className="flex flex-col items-center justify-end gap-1 h-full">
                        <div
                          className={cn(
                            "w-full rounded-[3px] border",
                            bar.h,
                            bar.crimson
                              ? "bg-[#800115] border-[#800115]"
                              : "bg-secondary border-border"
                          )}
                        />
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {bar.label} · {bar.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Autonomous AI Content Agent Interactive Simulator */}
        <section id="agent" className="scroll-mt-16 border-b border-border/80 bg-secondary/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-5">
                <div className="label-mono text-[#800115]">AUTONOMOUS CREATOR AGENT</div>
                <h2 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-foreground">
                  Set your Creator Persona. Let the system prep your next shoot.
                </h2>
                <p className="text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed">
                  Configure your niche, audience, and brand voice once. Every link shared to RMS follows whichever automation mode you pick:
                </p>

                <div className="space-y-2 pt-1">
                  {(Object.keys(AGENT_MODE_DEMOS) as DemoAgentMode[]).map((modeKey) => {
                    const item = AGENT_MODE_DEMOS[modeKey];
                    const active = demoMode === modeKey;
                    return (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => setDemoMode(modeKey)}
                        className={cn(
                          "w-full text-left p-3.5 rounded-lg border transition-colors flex items-start justify-between gap-3",
                          active
                            ? "bg-card border-[#800115]"
                            : "bg-background/70 border-border hover:border-foreground/30"
                        )}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-display font-bold text-sm",
                                active ? "text-[#800115]" : "text-foreground"
                              )}
                            >
                              {item.label}
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {item.headline}
                          </p>
                        </div>
                        <CheckCircle2
                          className={cn(
                            "size-4 shrink-0 mt-0.5",
                            active ? "text-[#800115]" : "text-border"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Interactive Visual Preview */}
              <div className="lg:col-span-7 rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-[2px] bg-[#800115]" />
                    <span className="text-xs font-mono font-semibold text-foreground">
                      Share Pipeline · Visual Output Preview
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md border border-border bg-background text-[10px] font-mono text-muted-foreground">
                      Persona: Tech &amp; Workflow
                    </span>
                    <span className="px-2 py-0.5 rounded-md border border-[#800115]/30 bg-[#800115]/10 text-[10px] font-mono text-[#800115] font-semibold">
                      {activeDemo.label}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md border border-border bg-background p-3 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Share2 className="size-3 text-[#800115]" />
                        <span>Shared Link + Caption</span>
                      </div>
                      <div className="text-[11px] font-mono text-foreground break-all leading-relaxed">
                        &quot;Clean hook transition breakdown! https://vt.tiktok.com/... #editing&quot;
                      </div>
                    </div>

                    <div className="rounded-md border border-[#800115]/40 bg-[#800115]/[0.03] p-3 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#800115] flex items-center gap-1.5 font-semibold">
                        <Cpu className="size-3" />
                        <span>Generated Card Preview</span>
                      </div>
                      <div className="text-xs font-display font-bold text-foreground truncate">
                        {activeDemo.previewTitle}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {activeDemo.previewTags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded border border-border bg-card text-[10px] font-mono text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                    {activeDemo.description}
                  </p>

                  <div className="space-y-2">
                    {activeDemo.steps.map((step, index) => (
                      <div
                        key={step.title}
                        className="p-3 rounded-md border border-border bg-background/70 flex items-start gap-3"
                      >
                        <span className="size-5 rounded-md bg-foreground text-background font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-display font-bold text-foreground">
                            {step.title}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {step.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border/70 flex items-center justify-between gap-2 text-[11px] font-mono flex-wrap">
                    <span className="text-muted-foreground">System state:</span>
                    <code className="px-2 py-1 rounded-md border border-border bg-secondary text-foreground font-semibold">
                      {activeDemo.statusOutput}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Interactive Module Tour */}
        <section id="system" className="scroll-mt-16 border-b border-border/80 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 space-y-8">
            <div className="space-y-2">
              <div className="label-mono text-[#800115]">MODULAR WORKSPACE</div>
              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
                Inside the Reference Management System.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Module 1: Inbox Triage */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <Inbox className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Inbox Triage</h3>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">A · R · S</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Fly through raw saves with keyboard shortcuts or trigger batch AI enrichment in one click.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 flex items-center justify-between gap-1.5">
                  {(["Approve", "Save Ref", "Skip"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setDemoTriageState(action)}
                      className={cn(
                        "flex-1 py-1.5 rounded text-[10px] font-mono font-semibold border transition-colors",
                        demoTriageState === action
                          ? "bg-[#800115] text-white border-[#800115]"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module 2: Breakdown Lab */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <Bookmark className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Reference Breakdown</h3>
                  </div>
                  <Film className="size-4 text-[#800115]" />
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Pinpoint the exact elements worth adapting—hook phrasing, pacing cuts, visuals, or topic angle.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 space-y-2">
                  <div className="h-2 w-full rounded-sm bg-secondary overflow-hidden flex">
                    <div className="w-[22%] bg-[#800115]" />
                    <div className="w-[53%] bg-foreground" />
                    <div className="w-[25%] bg-muted-foreground/40" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span className="text-[#800115] font-semibold">0–3s Hook</span>
                    <span>Body Beats</span>
                    <span>Payoff / CTA</span>
                  </div>
                </div>
              </div>

              {/* Module 3: Weekly Planner */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <Calendar className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Studio &amp; Planner</h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#800115] font-semibold">WEEKLY</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Keep production moving cleanly from script draft to planned publish slots without missed deadlines.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { day: "Mon", active: true },
                    { day: "Tue", active: false },
                    { day: "Wed", active: true },
                    { day: "Thu", active: false },
                    { day: "Fri", active: true },
                  ].map((d) => (
                    <div
                      key={d.day}
                      className={cn(
                        "py-1.5 rounded border text-[10px] font-mono",
                        d.active
                          ? "bg-[#800115] text-white border-[#800115] font-bold"
                          : "bg-card text-muted-foreground border-border"
                      )}
                    >
                      {d.day}
                    </div>
                  ))}
                </div>
              </div>

              {/* Module 4: Audio Bank */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <Music className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Audio &amp; Sounds</h3>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">AUTO-SYNCED</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Catalog recurring sounds &amp; background tracks across saved references and your own shipped posts.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-end gap-1 h-5">
                    {[10, 18, 12, 20, 9, 16, 14].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}px` }}
                        className={cn(
                          "w-1 rounded-xs",
                          i % 2 === 0 ? "bg-[#800115]" : "bg-foreground"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono text-foreground truncate">
                    original sound · 6 refs linked
                  </span>
                </div>
              </div>

              {/* Module 5: Sources Directory */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <Users className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Source Creators</h3>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">TRACKED</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  Monitor which creators consistently inspire your best-performing hooks across platforms.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 flex items-center justify-between gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-1 rounded border border-border bg-card font-semibold">
                    @studio.karya · 14
                  </span>
                  <span className="px-2 py-1 rounded border border-border bg-card font-semibold">
                    @film.craft · 9
                  </span>
                </div>
              </div>

              {/* Module 6: Analytics & Outlier AI */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-foreground/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md border border-border bg-secondary flex items-center justify-center">
                      <LineChart className="size-4" />
                    </div>
                    <h3 className="font-display font-bold text-base">Outlier Insights</h3>
                  </div>
                  <Sparkles className="size-4 text-[#800115]" />
                </div>
                <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                  AI reads across your 24h, 7d, and 30d checkpoints to tell you why top posts outperformed.
                </p>
                <div className="rounded-md border border-border bg-background p-2.5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Top Pattern:</span>
                  <span className="px-2 py-0.5 rounded bg-[#800115] text-white font-bold">
                    Visual Question + Fast Cut
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Final Editorial CTA */}
        <section className="bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
            <div className="rounded-lg border border-border bg-card p-8 sm:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <BrandLogo className="size-6" />
                  <span className="label-mono text-[#800115]">
                    READY TO SHIP DELIBERATELY
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-foreground">
                  Turn your next scroll session into tomorrow&apos;s production slate.
                </h2>
                <p className="text-xs font-mono text-muted-foreground">
                  Enter RMS, connect your iPhone shortcut token, and let your AI Content Agent organize the rest.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link href={primaryAppHref}>
                  <Button
                    size="lg"
                    className="h-10 rounded-md bg-[#800115] hover:bg-[#690111] text-white font-mono text-xs font-bold uppercase tracking-wider px-6 gap-2"
                  >
                    <span>{isAuthenticated ? "Open System" : "Enter RMS"}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                {!isAuthenticated && (
                  <Link href="/register?next=/home">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-10 rounded-md border-border bg-background font-mono text-xs font-semibold px-5"
                    >
                      Create Account
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandLogo className="size-4" />
            <span>RMS · Reference Management System</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/home" className="hover:text-foreground transition-colors">
              Workspace
            </Link>
            <Link href="/login?next=/home" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/register?next=/home" className="hover:text-foreground transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

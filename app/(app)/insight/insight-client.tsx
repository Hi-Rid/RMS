"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  BarChart2,
  Sparkles,
  ArrowUpRight,
  Layers,
  Compass,
  Mic2,
  Bookmark,
  Hash,
  AlertTriangle,
  Flame,
  TrendingDown,
  Info,
  Calendar,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { aiExplainPattern, type ExplainPatternResult } from "@/lib/actions/ai";
import type { InsightData, RankingRow, OutlierItem, CheckpointCurveItem } from "@/lib/queries/insight";

interface InsightClientProps {
  initialData: InsightData;
  hasGeminiKey: boolean;
}

export function InsightClient({ initialData, hasGeminiKey }: InsightClientProps) {
  const { summary, rankings, outliers, curves } = initialData;

  // Selected curve content
  const [selectedCurveKey, setSelectedCurveKey] = useState<string>(
    curves[0] ? `${curves[0].contentId}-${curves[0].platformName}` : ""
  );

  // AI Explain Pattern state
  const [explaining, setExplaining] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<ExplainPatternResult | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<"high" | "low">("high");

  const selectedCurve = curves.find(
    (c) => `${c.contentId}-${c.platformName}` === selectedCurveKey
  );

  async function handleExplainPattern(group: "high" | "low") {
    const items = group === "high" ? outliers.high : outliers.low;
    if (items.length === 0) {
      toast.error("Not enough outlier data to analyze.");
      return;
    }

    if (!hasGeminiKey) {
      toast.error("AI Engine is not ready yet. Check AI settings or environment configuration.");
      return;
    }

    setActiveGroup(group);
    setExplaining(true);
    try {
      const res = await aiExplainPattern({
        group,
        items: items.map((it) => ({
          title: it.title,
          finalRating: it.finalRating,
          formatName: it.formatName,
          hookTypeName: it.hookTypeName,
        })),
      });

      if (!res.ok) {
        toast.error(res.error.message || "Failed to analyze pattern.");
        return;
      }

      setAiAnalysis(res.data);
      setDialogOpen(true);
    } catch {
      toast.error("Network error during AI pattern analysis.");
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
          <TrendingUp className="size-6 text-foreground" />
          <span>Insight & Analytics</span>
        </h1>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Performance Benchmarks, Dimension Rankings & Growth Trajectories
        </p>
      </div>

      {/* Zone 1: Summary Benchmarks & Unused Shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Median Views */}
        <Card className="rounded-xl border bg-card p-4 shadow-none space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Median Views
          </span>
          <div className="text-2xl font-black font-display text-foreground">
            {summary.medianViews.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            Across all measured snapshots
          </p>
        </Card>

        {/* Measured Contents */}
        <Card className="rounded-xl border bg-card p-4 shadow-none space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Measured Contents
          </span>
          <div className="text-2xl font-black font-display text-foreground">
            {summary.measuredContentsCount}
            <span className="text-xs font-mono text-muted-foreground font-normal ml-1">
              (n={summary.measuredContentsCount})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            With completed evaluation metrics
          </p>
        </Card>

        {/* Original vs Referenced */}
        <Card className="rounded-xl border bg-card p-4 shadow-none space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Original vs Referenced
          </span>
          <div className="text-2xl font-black font-display text-foreground">
            {summary.originalContentsCount} : {summary.referencedContentsCount}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {summary.originalContentsCount + summary.referencedContentsCount > 0
              ? `${Math.round(
                  (summary.originalContentsCount /
                    (summary.originalContentsCount + summary.referencedContentsCount)) *
                    100
                )}% original concepts`
              : "0 total contents"}
          </p>
        </Card>

        {/* Unused Shortcuts */}
        <Card className="rounded-xl border bg-card p-4 shadow-none space-y-2 flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Unused Assets
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/references?unused=1"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs font-mono text-foreground font-bold transition-colors"
            >
              <span>{summary.unusedRefsCount} Refs</span>
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </Link>
            <Link
              href="/audio?unused=1"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs font-mono text-foreground font-bold transition-colors"
            >
              <span>{summary.unusedAudiosCount} Audios</span>
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            Ready for production use
          </p>
        </Card>
      </div>

      {/* Zone 2: Dimension Rankings (Tabs) */}
      <Card className="rounded-xl border bg-card shadow-none overflow-hidden">
        <CardHeader className="p-5 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold font-display uppercase tracking-wider">
                Dimension Rankings
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ranked by average content score &amp; median views (sample size threshold n &ge; {initialData.insightMinSample})
              </CardDescription>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5" />
              <span>Rows with n &lt; {initialData.insightMinSample} marked as small sample</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <Tabs defaultValue="pillars" className="w-full space-y-4">
            <TabsList className="bg-secondary/60 p-1 rounded-lg border border-border flex flex-wrap">
              <TabsTrigger value="pillars" className="text-xs font-mono uppercase tracking-wider">
                <Layers className="size-3 mr-1.5" />
                Pillars ({rankings.pillars.length})
              </TabsTrigger>
              <TabsTrigger value="formats" className="text-xs font-mono uppercase tracking-wider">
                <BarChart2 className="size-3 mr-1.5" />
                Formats ({rankings.formats.length})
              </TabsTrigger>
              <TabsTrigger value="hooks" className="text-xs font-mono uppercase tracking-wider">
                <Hash className="size-3 mr-1.5" />
                Hooks ({rankings.hooks.length})
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs font-mono uppercase tracking-wider">
                <Compass className="size-3 mr-1.5" />
                Sources ({rankings.sources.length})
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-xs font-mono uppercase tracking-wider">
                <Mic2 className="size-3 mr-1.5" />
                Audio ({rankings.audio.length})
              </TabsTrigger>
              <TabsTrigger value="series" className="text-xs font-mono uppercase tracking-wider">
                <Bookmark className="size-3 mr-1.5" />
                Series ({rankings.series.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pillars">
              <RankingTable rows={rankings.pillars} dimension="Pillar" />
            </TabsContent>
            <TabsContent value="formats">
              <RankingTable rows={rankings.formats} dimension="Format" />
            </TabsContent>
            <TabsContent value="hooks">
              <RankingTable rows={rankings.hooks} dimension="Hook Archetype" />
            </TabsContent>
            <TabsContent value="sources">
              <RankingTable rows={rankings.sources} dimension="Source Creator" />
            </TabsContent>
            <TabsContent value="audio">
              <RankingTable rows={rankings.audio} dimension="Audio / Track" />
            </TabsContent>
            <TabsContent value="series">
              <RankingTable rows={rankings.series} dimension="Content Series" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Zone 3: Outliers & AI Pattern Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* High Performers */}
        <Card className="rounded-xl border bg-card shadow-none flex flex-col justify-between">
          <CardHeader className="p-5 border-b border-border/80 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Top Performers (Outliers)
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExplainPattern("high")}
                disabled={explaining || outliers.high.length === 0}
                className="h-7 text-xs font-mono gap-1.5"
              >
                {explaining && activeGroup === "high" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                <span>Explain Pattern</span>
              </Button>
            </div>
            <CardDescription className="text-xs text-muted-foreground pt-1">
              Contents with highest evaluation ratings
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3 flex-1">
            {outliers.high.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                No high-performing evaluated contents yet.
              </p>
            ) : (
              <div className="space-y-2">
                {outliers.high.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`/contents/${item.id}`}
                    className="p-3 rounded-lg border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex items-center justify-between block group"
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="font-bold text-xs text-foreground truncate group-hover:underline">
                        #{idx + 1} {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        {item.formatName && <span>{item.formatName}</span>}
                        {item.hookTypeName && <span>&bull; {item.hookTypeName}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs font-bold shrink-0">
                      ★ {item.finalRating ?? "—"}/5.0
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Performers / Room for Improvement */}
        <Card className="rounded-xl border bg-card shadow-none flex flex-col justify-between">
          <CardHeader className="p-5 border-b border-border/80 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Underperformers (Opportunities)
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExplainPattern("low")}
                disabled={explaining || outliers.low.length === 0}
                className="h-7 text-xs font-mono gap-1.5"
              >
                {explaining && activeGroup === "low" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                <span>Explain Pattern</span>
              </Button>
            </div>
            <CardDescription className="text-xs text-muted-foreground pt-1">
              Contents below median benchmark with room for iteration
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3 flex-1">
            {outliers.low.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                No underperforming evaluated contents logged.
              </p>
            ) : (
              <div className="space-y-2">
                {outliers.low.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`/contents/${item.id}`}
                    className="p-3 rounded-lg border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex items-center justify-between block group"
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="font-bold text-xs text-foreground truncate group-hover:underline">
                        #{idx + 1} {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        {item.formatName && <span>{item.formatName}</span>}
                        {item.hookTypeName && <span>&bull; {item.hookTypeName}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground shrink-0">
                      ★ {item.finalRating ?? "—"}/5.0
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone 4: Checkpoint Curve Trajectory */}
      <Card className="rounded-xl border bg-card shadow-none">
        <CardHeader className="p-5 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold font-display uppercase tracking-wider flex items-center gap-2">
                <Calendar className="size-4 text-foreground" />
                <span>Checkpoint Curve Trajectory (24h &rarr; 7d &rarr; 30d)</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Observe viewership decay and algorithmic longevity per content post
              </CardDescription>
            </div>

            {curves.length > 0 && (
              <select
                value={selectedCurveKey}
                onChange={(e) => setSelectedCurveKey(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none max-w-[280px] truncate"
              >
                {curves.map((c) => (
                  <option
                    key={`${c.contentId}-${c.platformName}`}
                    value={`${c.contentId}-${c.platformName}`}
                  >
                    {c.contentTitle} ({c.platformName})
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {curves.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-mono text-muted-foreground">
                No checkpoint data available yet.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Fill post snapshots at 24h, 7d, or 30d checkpoints in the Evaluate tab to view longevity curves.
              </p>
            </div>
          ) : selectedCurve ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="font-bold text-foreground">
                  {selectedCurve.contentTitle} &bull;{" "}
                  <span className="text-muted-foreground">{selectedCurve.platformName}</span>
                </div>
              </div>

              {/* Trajectory comparison bars */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                {/* 24 Hours */}
                <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    24h Checkpoint
                  </span>
                  <div className="text-xl font-black font-display text-foreground">
                    {selectedCurve.h24Views !== null
                      ? selectedCurve.h24Views.toLocaleString()
                      : "Pending"}
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground"
                      style={{
                        width: selectedCurve.h24Views
                          ? `${Math.min(
                              100,
                              Math.max(
                                10,
                                ((selectedCurve.h24Views || 1) /
                                  Math.max(
                                    selectedCurve.h24Views || 1,
                                    selectedCurve.d7Views || 1,
                                    selectedCurve.d30Views || 1
                                  )) *
                                  100
                              )
                            )}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>

                {/* 7 Days */}
                <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    7d Checkpoint
                  </span>
                  <div className="text-xl font-black font-display text-foreground">
                    {selectedCurve.d7Views !== null
                      ? selectedCurve.d7Views.toLocaleString()
                      : "Pending"}
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground"
                      style={{
                        width: selectedCurve.d7Views
                          ? `${Math.min(
                              100,
                              Math.max(
                                10,
                                ((selectedCurve.d7Views || 1) /
                                  Math.max(
                                    selectedCurve.h24Views || 1,
                                    selectedCurve.d7Views || 1,
                                    selectedCurve.d30Views || 1
                                  )) *
                                  100
                              )
                            )}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>

                {/* 30 Days */}
                <div className="p-4 rounded-xl border border-border/80 bg-secondary/30 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    30d Checkpoint
                  </span>
                  <div className="text-xl font-black font-display text-foreground">
                    {selectedCurve.d30Views !== null
                      ? selectedCurve.d30Views.toLocaleString()
                      : "Pending"}
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground"
                      style={{
                        width: selectedCurve.d30Views
                          ? `${Math.min(
                              100,
                              Math.max(
                                10,
                                ((selectedCurve.d30Views || 1) /
                                  Math.max(
                                    selectedCurve.h24Views || 1,
                                    selectedCurve.d7Views || 1,
                                    selectedCurve.d30Views || 1
                                  )) *
                                  100
                              )
                            )}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* AI Pattern Explanation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold font-display uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span>
                AI Pattern Insights ({activeGroup === "high" ? "Top Performers" : "Underperformers"})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Objective observations across hook types, pacing, and format execution
            </DialogDescription>
          </DialogHeader>

          {aiAnalysis && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3.5 rounded-lg border border-border bg-secondary/40 space-y-1.5">
                <div className="font-bold text-foreground font-display">Synthesis</div>
                <p className="text-muted-foreground leading-relaxed">{aiAnalysis.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-foreground font-display text-[11px] uppercase tracking-wider">
                  Key Observations
                </div>
                <ul className="space-y-1.5">
                  {aiAnalysis.keyObservations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-foreground shrink-0 mt-0.5" />
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Caveat:</strong> {aiAnalysis.caveats}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RankingTable({ rows, dimension }: { rows: RankingRow[]; dimension: string }) {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-xs font-mono text-muted-foreground">
        No content data recorded for this dimension yet.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/40 border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="py-2.5 px-3">#</th>
            <th className="py-2.5 px-3">{dimension}</th>
            <th className="py-2.5 px-3 text-right">Avg Rating</th>
            <th className="py-2.5 px-3 text-right">Median Views</th>
            <th className="py-2.5 px-3 text-right">Sample (n)</th>
            <th className="py-2.5 px-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 font-sans">
          {rows.map((row, idx) => (
            <tr
              key={row.name}
              className={`hover:bg-secondary/20 transition-colors ${
                row.isSmallSample ? "opacity-60" : ""
              }`}
            >
              <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                {idx + 1}
              </td>
              <td className="py-2.5 px-3 font-bold text-foreground">
                {row.name}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                {row.avgRating ? `★ ${row.avgRating.toFixed(1)}` : "—"}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-foreground">
                {row.medianViews > 0 ? row.medianViews.toLocaleString() : "—"}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                n={row.sampleSize}
              </td>
              <td className="py-2.5 px-3">
                {row.isSmallSample ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="size-2.5" />
                    Small sample
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Sufficient sample
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/app/select-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { aiExplainPattern, type ExplainPatternResult } from "@/lib/actions/ai";
import type { InsightData, RankingRow } from "@/lib/queries/insight";

interface InsightClientProps {
  initialData: InsightData;
  aiReady: boolean;
  aiEnabled: boolean;
}

export function InsightClient({ initialData, aiReady, aiEnabled }: InsightClientProps) {
  const router = useRouter();
  const { summary, rankings, outliers, curves } = initialData;

  const [selectedCurveKey, setSelectedCurveKey] = useState<string>(
    curves[0] ? `${curves[0].contentId}-${curves[0].platformName}` : ""
  );

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
      toast.error("Not enough rated outlier data to analyze.");
      return;
    }

    if (!aiReady) {
      toast.error(
        aiEnabled
          ? "Add a Gemini API key in Settings -> AI to run pattern analysis."
          : "AI features are currently disabled in Settings -> AI.",
        {
          action: {
            label: "Open AI Settings",
            onClick: () => {
              router.push("/settings?tab=ai");
            },
          },
        }
      );
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
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-8 lg:px-10 space-y-6">
      <PageHeader
        title="Insight & Analytics"
        subtitle="Performance Benchmarks, Dimension Rankings & Growth Trajectories"
        icon={<TrendingUp className="size-6 text-foreground" />}
      />

      {!aiReady && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <span className="text-foreground">
            {aiEnabled
              ? "Add your Google Gemini API key to unlock AI Pattern Insights on top & bottom performers."
              : "AI Pattern Insights are turned off in your AI Settings."}
          </span>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md gap-1.5 bg-background">
            <Link href="/settings?tab=ai">
              <Settings className="size-3.5" />
              <span>Configure AI</span>
            </Link>
          </Button>
        </div>
      )}

      {/* Zone 1: Summary Benchmarks & Unused Shortcuts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-lg border bg-card p-4 shadow-none space-y-2">
          <span className="label-mono text-muted-foreground">Median Views</span>
          <div className="text-2xl font-black font-display text-foreground tabular-nums">
            {summary.measuredContentsCount > 0
              ? summary.medianViews.toLocaleString()
              : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {summary.measuredContentsCount > 0
              ? "Across all measured snapshots"
              : "No measured snapshots yet"}
          </p>
        </Card>

        <Card className="rounded-lg border bg-card p-4 shadow-none space-y-2">
          <span className="label-mono text-muted-foreground">Measured Contents</span>
          <div className="text-2xl font-black font-display text-foreground tabular-nums">
            {summary.measuredContentsCount}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            With completed evaluation metrics
          </p>
        </Card>

        <Card className="rounded-lg border bg-card p-4 shadow-none space-y-2">
          <span className="label-mono text-muted-foreground">Original vs Referenced</span>
          <div className="text-2xl font-black font-display text-foreground tabular-nums">
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

        <Card className="rounded-lg border bg-card p-4 shadow-none space-y-2 flex flex-col justify-between">
          <span className="label-mono text-muted-foreground">Unused Assets</span>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/references?unused=1"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-xs font-mono text-foreground font-bold transition-colors border border-border/80"
            >
              <span>{summary.unusedRefsCount} Refs</span>
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </Link>
            <Link
              href="/audio?unused=1"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-xs font-mono text-foreground font-bold transition-colors border border-border/80"
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

      {/* Zone 2: Dimension Rankings */}
      <Card className="rounded-lg border bg-card shadow-none overflow-hidden py-0">
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
              <Info className="size-3.5 shrink-0" />
              <span>Rows with n &lt; {initialData.insightMinSample} marked as small sample</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <Tabs defaultValue="pillars" className="w-full space-y-4">
            <TabsList className="w-full sm:w-fit h-auto bg-secondary/60 p-1 rounded-md border border-border flex flex-wrap justify-start gap-1">
              <TabsTrigger value="pillars" className="text-xs font-mono uppercase tracking-wider rounded-md">
                <Layers className="size-3 mr-1.5" />
                Pillars ({rankings.pillars.length})
              </TabsTrigger>
              <TabsTrigger value="formats" className="text-xs font-mono uppercase tracking-wider rounded-md">
                <BarChart2 className="size-3 mr-1.5" />
                Formats ({rankings.formats.length})
              </TabsTrigger>
              <TabsTrigger value="hooks" className="text-xs font-mono uppercase tracking-wider rounded-md">
                <Hash className="size-3 mr-1.5" />
                Hooks ({rankings.hooks.length})
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs font-mono uppercase tracking-wider rounded-md">
                <Compass className="size-3 mr-1.5" />
                Sources ({rankings.sources.length})
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-xs font-mono uppercase tracking-wider rounded-md">
                <Mic2 className="size-3 mr-1.5" />
                Audio ({rankings.audio.length})
              </TabsTrigger>
              <TabsTrigger value="series" className="text-xs font-mono uppercase tracking-wider rounded-md">
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
        <Card className="rounded-lg border bg-card shadow-none flex flex-col justify-between py-0">
          <CardHeader className="p-5 border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-success shrink-0" />
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Top Performers (4–5★)
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExplainPattern("high")}
                disabled={explaining || outliers.high.length === 0}
                className="h-8 text-xs font-mono rounded-md gap-1.5"
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
              Contents rated 4★ or higher
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3 flex-1">
            {outliers.high.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground font-mono">
                  No top performers rated 4★+ yet.
                </p>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md">
                  <Link href="/evaluate">Rate Posts in Evaluate →</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {outliers.high.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`/contents/${item.id}`}
                    className="p-3 rounded-md border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="font-bold text-xs text-foreground truncate group-hover:underline">
                        #{idx + 1} {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        {item.formatName && <span>{item.formatName}</span>}
                        {item.hookTypeName && <span>&bull; {item.hookTypeName}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs font-bold shrink-0 rounded-md">
                      ★ {item.finalRating ?? "—"}/5
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-card shadow-none flex flex-col justify-between py-0">
          <CardHeader className="p-5 border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="size-4 text-warning shrink-0" />
                <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                  Underperformers (&lt; 4★)
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExplainPattern("low")}
                disabled={explaining || outliers.low.length === 0}
                className="h-8 text-xs font-mono rounded-md gap-1.5"
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
              Contents rated below 4★ with room for iteration
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3 flex-1">
            {outliers.low.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground font-mono">
                  No underperforming contents rated below 4★.
                </p>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md">
                  <Link href="/contents">Open Studio →</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {outliers.low.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`/contents/${item.id}`}
                    className="p-3 rounded-md border border-border/80 bg-secondary/20 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="font-bold text-xs text-foreground truncate group-hover:underline">
                        #{idx + 1} {item.title}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        {item.formatName && <span>{item.formatName}</span>}
                        {item.hookTypeName && <span>&bull; {item.hookTypeName}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground shrink-0 rounded-md">
                      ★ {item.finalRating ?? "—"}/5
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone 4: Checkpoint Curve Trajectory */}
      <Card className="rounded-lg border bg-card shadow-none py-0">
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
              <SelectField
                ariaLabel="Select content checkpoint curve"
                value={selectedCurveKey}
                onValueChange={setSelectedCurveKey}
                className="w-full sm:w-auto sm:min-w-[240px] sm:max-w-[320px]"
                options={curves.map((c) => ({
                  value: `${c.contentId}-${c.platformName}`,
                  label: `${c.contentTitle} (${c.platformName})`,
                }))}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {curves.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-xs font-mono text-muted-foreground">
                No checkpoint data available yet. Fill post snapshots at 24h, 7d, or 30d to view longevity curves.
              </p>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs font-mono rounded-md">
                <Link href="/evaluate">Open Evaluate →</Link>
              </Button>
            </div>
          ) : selectedCurve ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs font-mono">
                <Link
                  href={`/contents/${selectedCurve.contentId}`}
                  className="font-bold text-foreground hover:underline"
                >
                  {selectedCurve.contentTitle} &bull;{" "}
                  <span className="text-muted-foreground">{selectedCurve.platformName}</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {[
                  { label: "24h Checkpoint", val: selectedCurve.h24Views },
                  { label: "7d Checkpoint", val: selectedCurve.d7Views },
                  { label: "30d Checkpoint", val: selectedCurve.d30Views },
                ].map((pt) => {
                  const maxViews = Math.max(
                    selectedCurve.h24Views || 0,
                    selectedCurve.d7Views || 0,
                    selectedCurve.d30Views || 0,
                    1
                  );
                  const widthPct =
                    pt.val && pt.val > 0 ? Math.min(100, Math.round((pt.val / maxViews) * 100)) : 0;

                  return (
                    <div
                      key={pt.label}
                      className="p-4 rounded-lg border border-border/80 bg-secondary/30 space-y-2"
                    >
                      <span className="label-mono text-muted-foreground">{pt.label}</span>
                      <div className="text-xl font-black font-display text-foreground tabular-nums">
                        {pt.val !== null ? pt.val.toLocaleString() : "Pending"}
                      </div>
                      <div className="h-2 w-full bg-border rounded-sm overflow-hidden">
                        <div className="h-full bg-foreground transition-all" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* AI Pattern Explanation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
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

              <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-foreground text-[11px] flex items-start gap-2">
                <AlertTriangle className="size-3.5 text-warning shrink-0 mt-0.5" />
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
            <th className="py-2.5 px-3 whitespace-nowrap">#</th>
            <th className="py-2.5 px-3">{dimension}</th>
            <th className="py-2.5 px-3 text-right whitespace-nowrap">Avg Rating</th>
            <th className="py-2.5 px-3 text-right whitespace-nowrap">Median Views</th>
            <th className="py-2.5 px-3 text-right whitespace-nowrap">Sample (n)</th>
            <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row, idx) => (
            <tr key={row.name} className="hover:bg-secondary/20 transition-colors">
              <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                {idx + 1}
              </td>
              <td className="py-2.5 px-3 font-bold text-foreground">
                {row.name}
              </td>
              <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground whitespace-nowrap tabular-nums">
                {row.avgRating ? `★ ${row.avgRating.toFixed(1)}` : "—"}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-foreground whitespace-nowrap tabular-nums">
                {row.medianViews > 0 ? row.medianViews.toLocaleString() : "—"}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                n={row.sampleSize}
              </td>
              <td className="py-2.5 px-3 whitespace-nowrap">
                {row.isSmallSample ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/25">
                    <AlertTriangle className="size-2.5" />
                    Small sample
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/25">
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

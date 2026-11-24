import { getAppSettings } from "@/lib/queries/settings";
import { getMasterData } from "@/lib/queries/references";
import { IngestTokenCard } from "@/app/(app)/settings/ingest-token-card";
import { Settings, Key, Database, Cpu, Sparkles, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const instant = false;

export default async function SettingsPage() {
  const [settings, masterData] = await Promise.all([
    getAppSettings(),
    getMasterData(),
  ]);

  const hasToken = settings.hasToken;
  const hasGeminiKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  );

  return (
    <div className="w-full max-w-5xl py-8 px-4 sm:px-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-display flex items-center gap-2.5">
          <Settings className="size-6 text-foreground" />
          <span>Settings</span>
        </h1>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Ingest API, Shortcuts, Master Data & AI Automation
        </p>
      </div>

      <Tabs defaultValue="ingest" className="w-full space-y-6">
        <div className="border-b border-border/80 pb-2">
          <TabsList className="bg-secondary/60 p-1 rounded-lg border border-border">
            <TabsTrigger value="ingest" className="text-xs font-mono uppercase tracking-wider">
              <Key className="size-3.5 mr-1.5" />
              <span>Ingest & Shortcuts</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs font-mono uppercase tracking-wider">
              <Cpu className="size-3.5 mr-1.5" />
              <span>AI Configuration</span>
            </TabsTrigger>
            <TabsTrigger value="master" className="text-xs font-mono uppercase tracking-wider">
              <Database className="size-3.5 mr-1.5" />
              <span>Master Data</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Ingest & Shortcuts */}
        <TabsContent value="ingest" className="space-y-6 focus-visible:outline-none">
          <IngestTokenCard initialHasToken={hasToken} />
        </TabsContent>

        {/* Tab 2: AI Configuration */}
        <TabsContent value="ai" className="space-y-6 focus-visible:outline-none">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              hasGeminiKey
                ? "bg-primary/5 border-primary/30 text-foreground"
                : "bg-amber-500/10 border-amber-500/30 text-foreground"
            }`}
          >
            {hasGeminiKey ? (
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 text-xs">
              <div className="font-bold flex items-center gap-2 font-display text-sm">
                <span>Google Gemini API (Free Tier)</span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                    hasGeminiKey
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 text-white"
                  }`}
                >
                  {hasGeminiKey ? "Connected & Active" : "Key Required"}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {hasGeminiKey
                  ? "Gemini 2.5 Flash is active and ready for Auto-Bedah Hook analysis, Viral Hook Generation (6 conversion angles), and Production Script Writing."
                  : "Add your Google Generative AI API Key to your .env.local file to enable AI Auto-Bedah and automation (1,500 requests/day 100% free with no credit card required)."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AI Capabilities Card */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    Available AI Features
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Automated content strategy workflows powered by Gemini
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Auto-Bedah Reference Analysis
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Extracts the opening 3-second hook, psychological hook archetype, visual composition notes, key takeaways, and 3 original adaptation ideas.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Viral Hook Generator (6 Angles)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Generates 6 high-conversion hook angles: Problem-First, Curiosity Gap, Contrarian, Relatable, Data/Result, and Provocative Question.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    4-Part Production Script Writer
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Drafts complete short-form shooting scripts: Hook (0-3s), Problem (3-15s), Value & B-Roll Action (15-45s), and CTA Closing.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* How to Setup Free Key */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-4">
              <CardHeader className="p-0 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-foreground" />
                  <CardTitle className="text-sm font-bold font-display uppercase tracking-wider">
                    How to Get Your API Key (Free)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Google AI Studio Free Tier (1,500 requests per day)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3.5 pt-2 text-xs">
                <ol className="space-y-2 list-decimal list-inside text-muted-foreground font-sans leading-relaxed">
                  <li>
                    Visit{" "}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground font-bold underline inline-flex items-center gap-1"
                    >
                      aistudio.google.com/apikey
                      <ExternalLink className="size-3" />
                    </a>
                  </li>
                  <li>Sign in with your personal Google account.</li>
                  <li>
                    Click <strong>Create API Key</strong> &rarr; select or create a project.
                  </li>
                  <li>Copy the generated API key (starts with <code>AIzaSy...</code>).</li>
                  <li>
                    Open your <code>.env.local</code> file in the RMS project root, and paste:
                  </li>
                </ol>

                <pre className="p-3 rounded-lg bg-secondary/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
                </pre>

                <p className="text-[11px] text-muted-foreground font-mono">
                  * Restart the dev server (<code>pnpm run dev</code>) after adding your API key so Next.js loads the new environment variable.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Master Data */}
        <TabsContent value="master" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Content Pillars */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Content Pillars ({masterData.pillars.length})
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  Active
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {masterData.pillars.map((p) => (
                  <span
                    key={p.id}
                    className="text-xs px-2.5 py-1 rounded-md bg-secondary border border-border/80 font-mono text-foreground"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </Card>

            {/* Platforms */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Supported Platforms ({masterData.platforms.length})
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  Auto-Detect
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {masterData.platforms.map((pl) => (
                  <span
                    key={pl.id}
                    className="text-xs px-2.5 py-1 rounded-md bg-secondary border border-border/80 font-mono text-foreground"
                  >
                    {pl.name}
                  </span>
                ))}
              </div>
            </Card>

            {/* Hook Archetypes */}
            <Card className="rounded-xl border bg-card p-5 shadow-none space-y-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-foreground">
                  Hook Archetypes ({masterData.hookTypes.length})
                </h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                  Taxonomy
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                {masterData.hookTypes.map((ht) => (
                  <div
                    key={ht.id}
                    className="p-2 rounded-md bg-secondary/40 border border-border/60 text-xs font-mono text-foreground truncate"
                    title={ht.name}
                  >
                    {ht.name}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

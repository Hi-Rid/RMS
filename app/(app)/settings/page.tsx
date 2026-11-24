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
                  ? "Gemini 2.5 Flash aktif. Siap digunakan untuk Auto-Bedah Hook, AI Hook Generator (6 angle viral), dan Script Generator."
                  : "Tambahkan Google Generative AI API Key di file .env.local Anda untuk mengaktifkan fitur Auto-Bedah dan AI Generator 100% Gratis (1.500 request/hari tanpa kartu kredit)."}
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
                    Fitur AI Studio yang Tersedia
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Fitur otomasi berbasis domain content strategy RMS
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Auto-Bedah Referensi
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Mengekstrak kalimat hook 3 detik pertama, tipe psikologis hook, visual visual notes, takeaway utama, dan 3 ide adaptasi original.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Viral Hook Generator (6 Angles)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Membuat 6 variasi hook conversion tinggi: Problem-First, Curiosity Gap, Kontrarian, Relatable, Data/Hasil, dan Question.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border/80 bg-secondary/30 space-y-1">
                  <div className="font-bold text-foreground flex items-center gap-1.5 font-display">
                    <span className="size-1.5 rounded-full bg-primary" />
                    4-Part Production Script Writer
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Menulis naskah short-form siap shooting: Hook (0-3s), Problem (3-15s), Value + B-Roll Action (15-45s), dan CTA Closing.
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
                    Cara Mendapatkan Key (100% Gratis)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Google AI Studio Free Tier (1.500 requests per hari)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3.5 pt-2 text-xs">
                <ol className="space-y-2 list-decimal list-inside text-muted-foreground font-sans leading-relaxed">
                  <li>
                    Buka situs{" "}
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
                  <li>Login menggunakan akun Google pribadi Anda.</li>
                  <li>
                    Klik tombol <strong>Create API Key</strong> &rarr; pilih project atau buat project baru.
                  </li>
                  <li>Copy API key yang muncul (berawalan <code>AIzaSy...</code>).</li>
                  <li>
                    Buka file <code>.env.local</code> di folder project RMS, lalu paste:
                  </li>
                </ol>

                <pre className="p-3 rounded-lg bg-secondary/60 border border-border text-[11px] font-mono text-foreground overflow-x-auto select-all">
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
                </pre>

                <p className="text-[11px] text-muted-foreground font-mono">
                  * Restart dev server (<code>pnpm run dev</code>) setelah menambahkan API key agar Next.js memuat environment variable baru.
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

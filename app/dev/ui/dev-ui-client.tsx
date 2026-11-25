"use client";

import { useState } from "react";
import { Feather, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/app/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function DevUiClient() {
  const [pillars, setPillars] = useState<string[]>(["fashion"]);
  const [format, setFormat] = useState<string>("reel");

  return (
    <div className="container mx-auto max-w-4xl space-y-12 px-6 py-12">
      <header className="space-y-2">
        <div className="label-mono text-muted-foreground">Design tokens · dev only</div>
        <div className="flex items-center gap-3">
          <BrandLogo className="size-9" />
          <h1 className="text-display">RMS</h1>
        </div>
        <p className="text-muted-foreground">
          Visual check for §13 tokens: JetBrains Mono body, Archivo display, flat surfaces, chip toggles.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-extrabold">Typography</h2>
        <p className="text-display">Display · Archivo 900</p>
        <p className="text-sm">
          Body · JetBrains Mono 400 14px. The quick brown fox jumps over the lazy dog — 0123456789 !@#$%^&*().
        </p>
        <p className="text-sm font-semibold">
          Emphasis · JetBrains Mono 600. Same size, heavier weight for inline emphasis.
        </p>
        <p className="label-mono text-muted-foreground">
          Label · JetBrains Mono 500 uppercase 11px tracking 0.12em
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            <Plus />
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">Inputs</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title-input">Title</Label>
            <Input id="title-input" placeholder="e.g. OOTD flat-lay" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary-input">Summary</Label>
            <Textarea id="summary-input" rows={3} placeholder="Short idea summary" />
          </div>
        </div>
        <div className="max-w-xs space-y-2">
          <Label>Format</Label>
          <Select defaultValue="reel">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reel">Reel</SelectItem>
              <SelectItem value="carousel">Carousel</SelectItem>
              <SelectItem value="story">Story</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">Chips and toggles</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="chip">Chip</Badge>
          <Badge variant="mono">mono label</Badge>
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="space-y-2">
          <Label>Pillars (multi)</Label>
          <ToggleGroup type="multiple" value={pillars} onValueChange={setPillars} variant="outline">
            <ToggleGroupItem value="fashion">Fashion</ToggleGroupItem>
            <ToggleGroupItem value="art">Art</ToggleGroupItem>
            <ToggleGroupItem value="diy">DIY</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <Label>Format (single)</Label>
          <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v)}>
            <ToggleGroupItem value="reel">Reel</ToggleGroupItem>
            <ToggleGroupItem value="carousel">Carousel</ToggleGroupItem>
            <ToggleGroupItem value="story">Story</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">Cards</h2>
        <Card>
          <CardHeader>
            <div className="label-mono text-muted-foreground">Fashion · Reel</div>
            <CardTitle>Sample reference</CardTitle>
            <CardDescription>@some.user · Selected · ♪ Audio title</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Card radius 8px, border only, no shadow. Verify visually.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold">Empty, Skeleton, Dialog</h2>
        <Empty>
          <EmptyMedia variant="icon">
            <Feather />
          </EmptyMedia>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>Add your first reference to get started.</EmptyDescription>
        </Empty>
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sample dialog</DialogTitle>
              <DialogDescription>No shadow. Radius from token.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl font-extrabold">Toasts</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => toast.success("Saved")}>Show success toast</Button>
          <Button variant="outline" onClick={() => toast("Just a note")}>Show info toast</Button>
          <Button variant="destructive" onClick={() => toast.error("Something failed")}>Show error toast</Button>
        </div>
      </section>
    </div>
  );
}

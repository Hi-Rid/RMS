# RMS Design System & Visual Foundations

> **Specification Standard**: [Impeccable](https://impeccable.style/) Design System  
> **Product Name**: **RMS** (Reference Management & Content Studio)  
> **Archetype**: Flat Warm Editorial / Ink-on-Paper / Clean Minimalist  
> **Mode**: Pure Light Mode (Dark mode strictly omitted by design)

---

## 1. Product Truth & Design Ethos

RMS is a high-speed, distraction-free command center for modern solo creators. It unifies high-signal reference capturing (Instagram, TikTok, YouTube), content drafting, and multi-interval evaluation checkpoints (24h, 7d, 30d).

The visual personality is modeled after **fine editorial print**:
- Tactile, warm paper substrate instead of clinical cold screens.
- Dense, structured black ink typography with authoritative display anchors.
- 100% flat surfaces with hairline borders — no simulated physical shadows or artificial gradients.
- High information density with zero decorative clutter.

---

## 2. Anti-Slop Directive (Impeccable Zero-Tolerance)

RMS explicitly rejects conventional **"AI Slop"** design patterns:

| Cliché AI Pattern | RMS Standard | Why |
| :--- | :--- | :--- |
| **Inter font everywhere** | **Archivo 900 + JetBrains Mono** | Gives RMS a distinct literary/editorial weight rather than generic SaaS look. |
| **Purple/Blue/Pink neon gradients** | **High-contrast Black Ink & Warm Paper** | Timeless readability, zero sensory fatigue during long drafting sessions. |
| **Floating cards with heavy drop shadows** | **Flat 1px Hairline Borders (`--shadow: none`)** | Editorial precision; depth is communicated via border contrast and hierarchy. |
| **Pill / Capsule buttons (`rounded-full`)** | **Subtle Rounded Rectangles (`rounded-md` / 6px)** | Prevents "tabung / cylinder" ballooning; keeps controls crisp and structural. |
| **Overly rounded `rounded-2xl` / `rounded-3xl`** | **Strict `0.375rem` - `0.5rem` Radius** | Architecture feels composed and engineered rather than bubbly. |

---

## 3. Formal Design Waivers

Impeccable requires explicit documentation of deliberate deviations from generic UI conventions:

### Waiver A6: Monospace Primary Body Font
- **Decision**: Primary body text is set in **JetBrains Mono** rather than a variable sans-serif.
- **Rationale**: RMS operates on raw inputs (URLs, hooks, scripts, timestamps, metrics). Monospaced rhythm reinforces the studio/workshop craft feel.
- **Mitigations Applied**:
  - Font size set to `14px` with relaxed leading `1.65` and tight tracking `-0.01em`.
  - OpenType stylistic sets enabled globally: `"ss01", "ss02", "cv01", "cv02"` to render natural alphanumeric shapes.
  - Micro-labels differentiated via `.label-mono` (UPPERCASE, `11px`, tracking `0.12em`, font-weight `500`).
  - Heavy visual grounding provided by **Archivo 900** for all headings.

### Waiver B2: Warm Paper Substrate
- **Decision**: Canvas background is set to warm paper `oklch(0.995 0.003 95)` rather than pure digital white `#FFFFFF`.
- **Rationale**: Reduces eye strain and creates a tactile, premium editorial substrate.
- **Mitigation**: Cards, dropdowns, and modals use pure white `oklch(1 0 0)` to create clean, intentional contrast layers without shadows.

---

## 4. Color System (OKLCH Native)

All color tokens are semantic and defined in `app/globals.css`. Never use raw hex values in components.

```css
:root {
  /* Canvas & Containers */
  --background: oklch(0.995 0.003 95);           /* Warm paper background */
  --card: oklch(1 0 0);                           /* Pure white card surface */
  --card-foreground: oklch(0.189 0.010 107.3);    /* High-contrast ink text */
  --popover: oklch(1 0 0);                        /* Pure white popover surface */
  --popover-foreground: oklch(0.189 0.010 107.3);

  /* Primary Brand (Ink Black) */
  --primary: oklch(0.189 0.010 107.3);            /* Black ink */
  --primary-foreground: oklch(1 0 0);             /* White ink */

  /* Neutral Surfaces */
  --secondary: oklch(0.967 0.005 95.1);          /* Light paper tint */
  --secondary-foreground: oklch(0.189 0.010 107.3);
  --muted: oklch(0.976 0.004 91.4);              /* Subtle gray container */
  --muted-foreground: oklch(0.478 0.013 95.3);   /* Readable secondary text */

  /* Hairlines & Accents */
  --border: oklch(0.928 0.006 264.5);            /* 1px crisp structural border */
  --input: oklch(0.928 0.006 264.5);
  --ring: oklch(0.189 0.010 107.3);

  /* Status Tokens */
  --destructive: oklch(0.5 0.182 29.5);          /* Editorial red alert */

  /* Sidebar Tokens */
  --sidebar: oklch(0.967 0.005 95.1);            /* Tinted paper sidebar */
  --sidebar-foreground: oklch(0.478 0.013 95.3);
  --sidebar-primary: oklch(0.189 0.010 107.3);
  --sidebar-border: oklch(0.913 0.008 91.5);
}
```

---

## 5. Shape & Corner Geometry

RMS strictly forbids pill/cylinder tubes (`rounded-full`) for buttons, inputs, chips, and cards.

```css
:root {
  --radius: 0.5rem;          /* 8px: Outer cards, dialog containers */
  --control-radius: 0.375rem; /* 6px: Buttons, inputs, pills, badges, tabs */
}
```

- **Cards & Dialogs**: `rounded-lg` or `rounded-xl` (8px–12px max).
- **Buttons & Controls**: `rounded-md` / `rounded-control` (6px).
- **Badges & Tags**: `rounded-md` (never capsule).
- **Monogram Icon**: `rounded-md` (square with subtle 6px corner).
- **Shadows**: `--shadow: none;` across all tiers (`2xs` through `2xl`).

---

## 6. Typography Scale & Hierarchy

| Role | Font Family | Weight | Size | Tracking / Leading | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | Archivo | Black (900) | 32px–36px | -0.02em / 1.1 | Dashboard greetings, major headings |
| **Section Title** | Archivo | Bold (700) | 18px–20px | -0.01em / 1.25 | Card headers, modal titles |
| **Body Primary** | JetBrains Mono | Regular (400) | 13px–14px | -0.01em / 1.65 | Content drafts, summaries, lists |
| **Body Bold** | JetBrains Mono | Semibold (600)| 13px–14px | -0.01em / 1.5 | Active states, strong labels |
| **Label Mono** | JetBrains Mono | Medium (500) | 10px–11px | +0.12em / 1.0 | Uppercase tags, step counters, status |
| **Code / URLs** | JetBrains Mono | Regular (400) | 12px | normal | URLs, database IDs, keyboard shortcuts |

---

## 7. Component Patterns

### 1. The Prompt Command Card
- Modeled after Eksis layout twin: large central container with prompt placeholder, bottom control strip with search toggle, privacy badge, and submit send arrow.
- Border: `1px solid var(--border)` with hover state `border-foreground/30`.

### 2. Category Filter Pills
- Rendered in a centered 2-row layout directly beneath the command bar.
- Subtle rounded rectangles (`rounded-md`, `px-3 py-1.5`, border `1px solid var(--border)`).
- Contains icon on the left, label, and optional numeric count pill on the right.

### 3. Step Onboarding Cards
- Clear numbered indicators (`1`, `2`, `3`) with `rounded-md` background.
- Active or completed steps use primary black ink with white text / checkmark.
- Inactive steps use subtle secondary paper background with clear borders.

### 4. Interactive Feedback & Empty States
- Always provide clear editorial copy and an explicit primary action button (`+ Add reference`, `+ Create content`).
- Keyboard shortcuts clearly indicated with `<kbd>` tags (`⌘K`, `/`).

---

## 8. Impeccable Design Commands Reference

When asking the agent to refine or inspect RMS views, use these standard Impeccable commands:

- `/critique`: Evaluate the layout from a UX perspective (hierarchy, density, friction).
- `/audit`: Technical quality pass (accessibility, keyboard navigation, contrast, font rendering).
- `/polish`: Spacing pass, vertical rhythm, alignment, hairline consistency.
- `/bolder`: Enhance editorial drama, typography contrast, or distinctive layout moments.
- `/quieter`: Tones down competing visual elements, reducing cognitive friction.
- `/harden`: Production-readiness check (empty states, text truncation, overflow, error states).
- `/typeset`: Fine-tune font pairing, line-height, letter-spacing, and typographic hierarchy.

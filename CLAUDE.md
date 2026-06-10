# Claude Code house rules for MegaMegaTypeType

Read SPEC.md before doing anything. It explains the project and the data.

## How Love & Logic likes to be talked to

- British English. Short sentences. No buzzwords (delve, leverage, robust, seamless, innovative, transformative, comprehensive, meticulous, etc.).
- No em dashes. Use en dashes or rewrite.
- No Oxford commas.
- Skip preamble like "I'll now…" — just do the thing.
- Confirm only when there's a real decision to make.

## Tech expectations

- Next.js 14+ App Router + TypeScript + Tailwind. shadcn/ui for components.
- Client-side filtering for the directory. The dataset is 638 entries, around 1.2 MB total uncompressed. Loads instantly. Don't reach for a database in v1.
- Server route only for the brief-mode Claude call.
- No auth, no DB, no accounts in v1.
- Vercel-friendly. No long-running background jobs.

## Data

`data/typefaces-*.json` — one file per foundry. Same schema across all. Merge into a single in-memory list on app start.

Schema (per entry):

```ts
type Typeface = {
  name: string;
  foundry: string;
  url: string;                          // direct link to the typeface page on the foundry site
  designer: string | null;
  year: number | null;
  category: "serif" | "sans-serif" | "slab" | "display" | "mono" | "script" | "blackletter";
  subcategory: string;
  classification_notes: string;
  weights: string[];
  optical_sizes_or_widths: string[];
  subfamilies: string[];
  has_condensed: boolean;
  has_italic: boolean;
  has_mono: boolean;
  languages: string[];
  tier: "best" | "okay" | "loose" | "notgood";
  type: "foundry" | "reseller" | "free";
  tags: string[];
  summary: string;                      // one sentence, our voice
  description: string;                  // 2-3 sentences, our voice
  foundry_blurb: string;                // paraphrase of foundry copy — consider stripping for public
};
```

`data/foundries.json` — the 222 foundries from Love & Logic's bookmarks. Use this if you need foundry-level metadata (homepage URL, tier) for filters or for the foundry pages.

`docs/typography.md` — typography reference (anatomy, classifications, mood mapping). The brief-mode endpoint should pass relevant sections to Claude as context.

## Done definition for v1

Three pages working:

1. Directory at `/` with working filters, sort, search.
2. Typeface detail at `/t/[foundry]/[typeface]`.
3. Brief mode at `/brief` returning 10 ranked matches from the Claude API.

Deployed to Vercel under a domain.

That's v1. Don't add features beyond SPEC.md unless asked.

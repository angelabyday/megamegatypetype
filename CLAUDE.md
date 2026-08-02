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

### Data quality rules for indexing

When indexing a foundry, only add entries that are actual typefaces. Never index:

- Site navigation or legal pages (About, Contact, Cookie Policy, Privacy Policy, EULA, Licensing, Imprint, Sitemap, Copyright, Client Area, Support, Newsletter, Gallery, Publications, Admin).
- "In use" or "Fonts in use" showcase pages.
- Test font or trial font download pages.
- Font bundles or multi-font packs. The individual fonts get their own entries; bundles are duplicates.
- The foundry itself as an entry (a page titled with the foundry's own name), unless the foundry genuinely sells a typeface named after itself (e.g. Almarena).

Specimen screenshots must show the typeface. Reject screenshots of cookie banners, consent walls, Cloudflare checks, error pages, blank pages, language-coverage maps or unrendered canvases, and rescrape.

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

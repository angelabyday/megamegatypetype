# MegaMegaTypeType — Project Specification

A public web app for finding typefaces. Filterable directory of 638+ verified typefaces from independent foundries, with a brief-to-fonts AI mode powered by Claude.

## Background

This project started life as a Claude skill (font-finder.skill) that Love & Logic uses inside Claude conversations. The skill works but skills require install and don't scale to public use. This is the web version: same data, public access, proper filter UI.

The data was built by scraping the catalogue page of each foundry, then writing a structured JSON record per typeface with: name, foundry, URL, designer, year, category, subcategory, classification notes, weights, optical sizes/widths, subfamilies, has_condensed/italic/mono flags, languages, tier, type, tags, summary, description, foundry blurb.

## What's in this folder

```
megamegatypetype/
├── SPEC.md          ← this file
├── README.md        ← install + run commands
├── CLAUDE.md        ← house rules for Claude Code
├── data/
│   ├── foundries.json                   222 foundry homepages, tagged with tier (best/okay/loose/notgood) and type (foundry/reseller/free)
│   ├── typefaces-klim.json              55 typefaces
│   ├── typefaces-pangram-pangram.json   68
│   ├── typefaces-displaay.json          33
│   ├── typefaces-schick-toikka.json     44
│   ├── typefaces-dinamo.json            45
│   ├── typefaces-dalton-maag.json       77
│   ├── typefaces-atipo.json             50
│   ├── typefaces-optimo.json            28
│   ├── typefaces-sociotype.json         5
│   ├── typefaces-grilli.json            21
│   ├── typefaces-hoefler.json           45
│   ├── typefaces-f37.json               76
│   └── typefaces-commercial-type.json   91
│                                        Total: 638 typefaces across 13 foundries
└── docs/
    ├── foundries.md          human-readable foundry list grouped by tier
    ├── typography.md         830 lines of typography reference (anatomy, classifications, mood mapping, reference typefaces). Useful for the AI brief-to-fonts mode.
    ├── skill-reference.md    the original Claude skill's SKILL.md. Source of the brief-mode operational logic: the 8 clarifying questions, the output format, source-priority rules, the 9-step image identification workflow. The web app's `/api/brief` route should mirror this logic. Image identification is not in v1 but the workflow is here for when it lands.
    ├── font-finder.skill     the packaged skill file (zip archive). Archival reference. Same content as the rest of docs/ plus the data — useful for context, not needed at runtime.
    └── skill-evals/
        └── evals.json        three real test briefs used during skill development (wellness brand, Söhne alternative, tech startup). Useful as fixtures for testing the brief-mode endpoint.
```

## v1 scope (build this)

A static-data web app. No database, no auth, no accounts. The JSON files in `data/` are the source of truth; the UI reads them at build time or on the client.

### Pages

1. **Home / directory** (`/`)
   - List of typefaces in a grid or table.
   - Filters: foundry (multi-select), category (serif / sans-serif / display / mono / slab / script / blackletter), has_condensed, has_italic, has_mono, tier (best / okay / notgood), tags (multi-select).
   - Sort by name, by foundry, by year (newest/oldest).
   - Free-text search across name, foundry, designer, tags, summary.
   - Each row: name (bold), foundry (linked), category badge, key tag chips, click-through to the foundry's own typeface page (`url` field).

2. **Typeface detail** (`/t/[foundry-slug]/[typeface-slug]`)
   - Shows the full entry: name, foundry, designer, year, subcategory, classification notes, weights, subfamilies, languages, tags, summary, description (Love & Logic's voice), foundry_blurb (paraphrase of foundry copy).
   - Big external link out to the foundry page.

3. **Brief mode** (`/brief`)
   - Text box for a brief: "modern editorial serif for a wellness brand, premium but approachable, no fashion didone".
   - Submit calls a Claude API endpoint (server-side route) that filters the index by category and tags, then asks Claude (Haiku for cost) to rank 10 matches with a one-line reason each.
   - Renders the 10 results inline.
   - **The brief-mode logic is already specified in `docs/skill-reference.md`** (the original Claude skill). It covers: 8 clarifying questions for vague briefs (typeface category, role and surfaces, references, three adjectives, era, budget, audience, sector, wordmark vs system, voice intensity); the source-priority rule (Best tier first, then OkayGood + loose, free fallback only when relevant); the output format (10 typefaces, name + link, no extra prose by default); and the "outside list" flagging rule for when nothing in the index fits. Mirror that logic in the API route's system prompt. Use `docs/skill-evals/evals.json` as fixtures for testing.

### Out of scope for v1

- User accounts, login, saved shortlists
- Image upload for typeface identification (later)
- Rendering the actual typefaces in the UI (licensing — keep UI in system font)
- A real database (JSON files are fine until we have writes)
- Pagination (638 entries fits comfortably without paging if filters work)
- Analytics, cookie banners (add when going live publicly)

## Recommended tech stack

- **Next.js 14+ (App Router) + React 18 + TypeScript**
- **Tailwind CSS** for styling (matches the no-frills directory aesthetic)
- **shadcn/ui** for filter and form components
- **Vercel** for hosting (free tier handles this easily)
- **Claude API** for the brief mode (server-side route, `claude-haiku-4-5` is plenty for matching, cheap)

Single-page filterable interfaces work brilliantly with client-side filtering. Load the full dataset as a JSON import at build time, do all filtering in the browser. No API needed for the directory; the brief mode is the only thing that needs a server route.

## Design direction

- White background, black text, 0.5px borders. Looks like a directory, not a marketing site.
- System font for the UI (no licensing issues). Don't try to render the typefaces themselves.
- Filter chips and category badges. No hero sections, no marketing copy.
- The data is the product.

## Things to know about the data

- `tier` reflects Love & Logic's own foundry ranking from her bookmarks: `best` (top of mind) > `okay` (solid) > `loose` (ungrouped) > `notgood` (kept for completeness). Default UI sort should weight `best` first.
- `type` is `foundry`, `reseller`, or `free`. Hoefler & Co was historically tagged `notgood` in the foundry list but the actual typefaces are widely used; keep the tier but don't hide them.
- `year` is `null` for foundries that don't publish release years on their pages (Atipo, Pangram, Optimo, Sociotype, parts of Commercial Type). UI should handle missing years gracefully.
- `subfamilies` arrays capture related cuts within a family (e.g. Söhne, Söhne Schmal, Söhne Mono). UI could group these or show them as related-typeface chips on the detail page.
- The `description` field is Love & Logic's editorial voice. The `foundry_blurb` field paraphrases what the foundry themselves say. **For a public site, consider whether to strip `foundry_blurb`** — paraphrased copy from foundries is borderline. Easiest safe path: show `description` only, link out to the foundry for their own words.

## Backlog for later versions

- Monthly auto-scan of foundry catalogue pages to add new typefaces (already scoped, runs as a scheduled task)
- Image upload for typeface identification (Claude vision)
- Saved shortlists, shareable URLs
- "Compare" mode: pick 2-3 typefaces and see them side by side (in foundry-screenshot form, since we can't render the fonts)
- Add the remaining foundries from `foundries.json` to push past 1,500 typefaces
- Google Fonts and Fontshare as a separate "free" filter
- A "pairing" view that uses the existing typography reference (`docs/typography.md`) to suggest display+text combinations

## Name and tone

MegaMegaTypeType — playful, repeated, a little ridiculous. Lean into that. The UI should be quiet but the brand can be loud where appropriate. Avoid corporate type-foundry tone ("the contemporary serif for…"). Speak plainly.

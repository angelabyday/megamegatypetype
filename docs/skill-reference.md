---
name: font-finder
description: Identifies typefaces from images and recommends fonts from Love & Logic's curated foundry list (plus Google Fonts and Fontshare) based on visual references or written briefs. Use this skill whenever Love & Logic mentions finding a font, identifying type, picking a typeface, choosing fonts for a brand, "what font is this", "font like X", "fonts that feel Y", typeface recommendations, type pairings, font alternatives, or shares an image containing type. Also trigger on phrases like "what's this typeface", "find me a serif/sans/display/mono for…", "something like Söhne/Tiempos/Druk", "fonts in the style of…", "good display font for…", "modern/editorial/luxury/tech/heritage typeface", or any time fonts come up in a brand or design context.
---

# Font Finder

A skill for identifying typefaces from images and recommending fonts from Love & Logic's curated foundry list, plus Google Fonts and Fontshare. Built to do typography properly: look at the letterforms, name what's there, then propose options that match.

Two modes:

1. **Identify** — Love & Logic shares an image of type. Work out what it is, or get as close as possible.
2. **Recommend** — Love & Logic describes a brief or shares a moodboard. Propose typefaces that fit, drawn from her foundry list first.

## How to work

### Always read the typography reference before answering

Before answering any font question, read `references/typography.md`. It contains the anatomy, classifications, optical features, mood mapping, pairing rules, and reference typefaces you need to do the job properly. Don't skip it. The reference is dense; skim the sections relevant to the question, but don't try to answer from general knowledge alone.

For the foundry list, read `references/foundries.md` (human-readable) or `references/foundries.json` (structured). The JSON is better when you need to filter programmatically.

For typeface-level data, consult the per-foundry indexes in `references/`:

- `typefaces-klim.json` — 55 Klim typefaces
- `typefaces-pangram-pangram.json` — 68 Pangram Pangram typefaces
- `typefaces-displaay.json` — 33 Displaay typefaces
- `typefaces-schick-toikka.json` — 44 Schick Toikka typefaces (parent + sub-cuts)
- `typefaces-dinamo.json` — 45 Dinamo typefaces
- `typefaces-dalton-maag.json` — 77 Dalton Maag typefaces
- `typefaces-atipo.json` — 50 Atipo typefaces
- `typefaces-optimo.json` — 28 Optimo typefaces
- `typefaces-sociotype.json` — 5 Sociotype typefaces
- `typefaces-grilli.json` — 21 Grilli Type typefaces (the full GT family)
- `typefaces-hoefler.json` — 45 Hoefler & Co typefaces
- `typefaces-f37.json` — 76 F37 typefaces
- `typefaces-commercial-type.json` — 91 Commercial Type typefaces

Each entry has a verified URL, classification, weights, subfamilies, has_condensed flag, tags, summary, description and a paraphrase of the foundry's own copy. These are the source of truth for any recommendation involving these foundries. As more foundries get indexed, additional `typefaces-[foundry].json` files will appear here. Always prefer the indexes over web search or memory when the foundry is in the index.

Schema for each typeface entry:
- `name`, `foundry`, `url`, `designer`, `year`
- `category` (one of serif, sans-serif, slab, display, mono, script, blackletter)
- `subcategory` (more specific class, e.g. neo-grotesque, transitional serif, didone)
- `classification_notes` — Klim's own classification language plus key claims
- `weights`, `optical_sizes_or_widths`, `subfamilies`
- `has_condensed`, `has_italic`, `has_mono` — booleans for quick filtering
- `languages`, `tier`, `type`
- `tags` — short keywords for matching
- `summary` — one-line characterisation (under 25 words)
- `description` — 2-3 sentence hybrid voice paragraph
- `foundry_blurb` — 2-3 sentences paraphrasing the foundry's own copy

When recommending: filter the index by `category`, `has_condensed`, `subcategory`, `tags` etc. before going wider. The index URLs are pre-verified — no need to web-check Klim links.

### For identification (image input)

Image study is rigorous, not casual. Work through these steps in order. Don't skip ahead to naming candidates.

**Step 1: Classification snapshot.** Note writing system, broad class (serif, sans, slab, script, blackletter, display, mono), and any obvious treatment (small caps, condensed, italic, all-caps).

**Step 2: Mandatory glyph-by-glyph breakdown.** Before naming a single candidate, write down what you actually see on each of these distinctive glyphs (only the ones present in the image). Internal note, not for the final answer unless asked:

- `a` — single-storey or double-storey, terminal shape, bowl proportion
- `g` — single-storey or double-storey, ear shape, loop shape and size
- `e` — bar angle (level, tilted, oblique), aperture
- `R` — leg shape (straight, curved, kicked), junction
- `Q` — tail (short, sweeping, crossing the bowl, dropped)
- `M` — apex flat or pointed, splay (parallel verticals or splayed sides), midpoint reach
- `t` — top shape (flat, angled, hooked), crossbar position
- `y` — descender shape (straight, curved, hooked)
- `&` — figure shape (italic-derived, et-ligature, geometric)
- numerals — lining or oldstyle, height, distinctive `1`, `4`, `7`

If the image only shows a few words, work with what's there. Note distinctive features even on common letters: `i` dot shape (round, square, rectangular), `f` descending or not, `j` dot, `o` width and stress.

**Step 3: Optical reading.** Note x-height band (low/medium/high relative to cap height), contrast level (low/medium/high), stress axis (vertical, slanted, reverse), terminal style (ball, sheared, slab, wedge, teardrop, no-terminal), aperture (open, closed, medium), joint articulation, character width.

**Step 4: Hypothesis.** Based on Steps 2 and 3, name a shortlist of candidate typefaces. Rank in order of fit. Aim for 5 to 10 candidates so the comparison in Step 6 has enough range.

**Step 5: Brand context research.** If the image looks like part of a brand identity — logo, wordmark, heading from a website, packaging, signage, brand book, ad campaign — try to identify the brand and look up what typeface it uses. This often gets you to the answer faster and more accurately than visual ID alone, because the brand's design press, case studies, or own brand guidelines may name the font directly.

Signals that an image is brand identity work: a tagline beneath the wordmark ("We curate the finest properties..."), a sector word (Amsterdam, London, Acme Co.), photography or product shots framing the type, a logotype layout, recognisable brand colours, "since [year]" or similar heritage cue.

When you suspect brand work:
- Read any visible text in the image. Brand name, tagline, sector words.
- Use WebSearch with queries like `"[brand name]" typeface`, `"[brand name]" font`, `"[brand name]" brand guidelines`, `"[brand name]" rebrand designer`.
- Check **Fonts In Use** (`https://fontsinuse.com/`) by searching the brand name.
- Check **Brand New** (`https://www.underconsideration.com/brandnew/`) for rebrand case studies that often name the type.
- Check the brand's own website footer or press kit for a "designed by" credit, then look up the agency's case study.
- If the image shows a property listing, podcast cover, magazine, or product, search the publication or product name directly.

If research surfaces a named typeface, treat it as a strong candidate (often the answer) and still do Step 6 comparison to confirm against the visual evidence. Don't skip the visual check — agencies sometimes change typefaces between brand assets.

If research finds nothing, carry on with visual ID alone.

**Step 6: Compare against candidates.** This is the discipline most font ID skips. For your top 3 candidates, recall their distinctive glyphs and check whether each matches what you observed in Step 2. If a candidate's `a` ear or `R` leg doesn't match the image, demote it. If you're unsure of a candidate's specifics, consult Step 10 of `references/typography.md` (reference typefaces) or use WebFetch to pull the foundry's specimen page. The comparison step is what separates a confident ID from a guess.

**Step 7: Confidence call.**
- **High** — distinctive glyphs match a specific typeface across multiple letters, or research surfaced a named typeface that matches the visual evidence. Name the most likely with conviction.
- **Medium** — class is clear, several candidates fit, no single one wins. Give the ranked shortlist and say "most likely X, but could be Y or Z".
- **Low** — class is fuzzy or the image is too small/low-quality. Describe what you see and rank the closest 10 candidates.
- **Insufficient** — image is too small, too blurry, or shows too few characters. Describe what you can see and hand off (Step 8).

**Step 8: Specialist handoff when confidence is below medium.** Tell Love & Logic to run the image through:
- **WhatTheFont** at `https://www.myfonts.com/pages/whatthefont` — best for clean web-resolution images of text
- **Identifont** at `https://www.identifont.com/` — questionnaire-based, useful when the image quality is low but you can answer questions about the form
- **Fonts In Use** at `https://fontsinuse.com/` — search by keywords from the design context (sector, brand, year)

Add a one-line summary of the most distinctive features they should focus on when using those tools, e.g. "Look for the splayed `M` and the inward-curving `c` terminal — those rule out most neo-grotesques."

**Step 9: Output.** Use the identification output format in the "Output format" section below: most-likely + 9 alternatives + confidence. Always link to the specific typeface page (see "Linking to typefaces"), not the foundry homepage.

### For recommendation (description or brief)

1. Translate the brief into typographic features. Use the brief-terminology mapping in section 8 of `references/typography.md`. If the brief uses words like "modern", "elegant", "tech", "editorial", "warm", convert these to features (contrast, x-height, axis, terminals, etc.) before suggesting anything.

2. If the brief is vague or partial, ask the clarifying questions in the section below before recommending. Don't dump all eight at once: read what Love & Logic has already given, identify what's still missing, and ask only the missing ones. If the brief is rich (image + reference brands + sector + role all clear), skip this step and go straight to recommendations.

3. Propose a primary recommendation set: typically 3–5 candidates. Structure them by role:
   - **Display** (headlines, posters)
   - **Text** (body, UI, paragraphs)
   - **Mono** (code, captions, accents) — only if relevant

4. For each candidate, give:
   - Typeface name
   - Foundry + tier (`best` / `okay` / `notgood`) and type (`foundry` / `reseller` / `free`)
   - **Direct URL to the typeface's own page**, not just the foundry homepage. Love & Logic wants to click straight through to the font, not hunt for it. If you're not certain of the exact deep-link URL, construct the most plausible one from the foundry's URL pattern (most foundries use `/typefaces/[name]` or `/fonts/[name]` or similar) and note that it's a constructed link. If you genuinely can't work out the deep link, give the foundry URL plus the search term Love & Logic should use, e.g. `https://klim.co.nz/ — search "Domaine Display"`.
   - One-line reason tied to the brief (point at specific letterform features, not vibes)
   - A pairing suggestion if useful

5. **Source priority:**
   - Best foundries first.
   - Then OkayGood + loose.
   - Notgood only if the brief specifically calls for something only those have, or as a last resort.
   - Google Fonts and Fontshare for free/budget briefs, or as accessible alternatives alongside paid picks.
   - Outside Love & Logic's list: only if nothing in the list comes close. Flag clearly: "Outside your list — [Foundry]".

### Clarifying questions for vague briefs

When a brief lacks specifics, work through this list and ask only the questions that aren't already answered. Order them roughly by impact. Stop once you have enough to recommend with conviction.

**"I don't know" is always a valid answer.** Make that explicit when asking. If Love & Logic answers "I don't know" or "you decide", treat it as permission to choose based on the rest of the brief, and skip that question — don't push back. The skill is meant to reduce decision fatigue, not add to it.

1. **Typeface category.** Serif, sans serif, display, mono, slab, script, blackletter, or "I don't know — you decide"? If a category is named, that filters the rest. If not, infer from the mood and references later in the questions.

2. **Role and surfaces.** Display only (wordmark, headlines, posters), text (body, UI, long copy), or full system (display + text + mono)? And where will it appear: web, print, app, broadcast, packaging, OOH? "I don't know" is fine — assume full system across web and print as the default.

3. **Reference brands or typefaces — and what to avoid.** "Like Vogue but not as cold" or "like Stripe but warmer" gives more direction in one sentence than ten adjectives. The "not like" half often does more work than the "like" half. "I don't know" is fine — lean on the adjectives instead.

4. **Three adjectives for the brand voice, plus one trap.** "Considered, warm, premium — not corporate." Forces commitment and gives something to disqualify against. "I don't know" is fine — fall back on sector and audience.

5. **Era feel: contemporary, established, timeless, or revival?** A 2026 modern grotesque reads differently from a 1950s Akzidenz revival, a Garalde from 1530, or a deliberately retro 70s slab. Tells you where in history the brand is pretending to come from. "I don't know" defaults to contemporary.

6. **Budget tier and licensing scope.** Klim/Commercial Type/Pangram (paid retail), Google Fonts/Fontshare (free), or somewhere in between? Does it need app embedding, server-side rendering, or high-traffic web? "I don't know" defaults to mid-tier paid with a free fallback offered alongside.

7. **Audience age and sophistication.** A wealth-management client and a Gen-Z streetwear brand both ask for "modern, premium" and need different fonts. "I don't know" defaults to general-adult professional.

8. **Sector and direct competitors.** What category does the brand sit in, and what's the type convention there? Sometimes the brief is "fit the category", more often it's "stand out from it". "I don't know" is fine — the rest of the brief usually carries enough signal.

9. **Wordmark vs full system.** Is this just a logo, or does the whole brand live in this type? A wordmark can use something niche, custom, or even free-with-edits. A full system needs weights, italics, ideally variable axes. "I don't know" defaults to full system.

10. **Voice intensity: hero or workhorse?** Some briefs want type to do brand-voice work (Aesop's Optima, MoMA's Franklin Gothic). Others want type to recede so photography, colour, or copy lead (Stripe's Söhne mostly disappears). "Personality on" vs "personality off" changes which faces qualify. "I don't know" defaults to a balanced system: characterful display, quiet text.

Questions 1, 3 and 4 are the highest-leverage. If Love & Logic gives you one-line answers to those, you can usually recommend without the rest. Use the others when you're still seeing five viable directions and need to narrow.

### Linking to typefaces

Every typeface recommendation must include a direct link to that typeface's own page, not the foundry homepage. Love & Logic wants to click and land on the font. **404 links are unacceptable.**

**Verify links before sending. Don't guess.**

The verification rules are:

1. **For Google Fonts and Fontshare**, the URL pattern is reliable enough to construct without a check:
   - Google Fonts: `https://fonts.google.com/specimen/[Typeface+Name]` (use `+` for spaces; capitalisation matters)
   - Fontshare: `https://www.fontshare.com/fonts/[typeface-slug]` (lowercase, hyphenated)

2. **For these foundries the verified URL patterns are:**
   - Klim: `https://klim.co.nz/fonts/[slug]/` (NOT `/retail-fonts/`)
   - Pangram Pangram: `https://pangrampangram.com/products/[slug]`
   - Displaay: `https://displaay.net/typeface/[slug]` or `https://displaay.net/typeface/[collection-slug]/[member-slug]/` for typefaces in named collections (e.g. Reckless Collection, Bagoss Collection)
   - Grilli Type: `https://www.grillitype.com/typeface/[slug]`
   - Schick Toikka: `https://www.schick-toikka.com/[slug]` (no `/typefaces/` prefix)
   - Hoefler & Co: `https://www.typography.com/fonts/[slug]/overview`
   - Commercial Type: `https://commercialtype.com/catalog/[slug]` or `/catalog/[family]/[member]` for sub-families
   - Commercial Classics: `https://commercialclassics.com/typefaces/[slug]`
   - TypeTogether: `https://www.type-together.com/[slug]-font`
   - Optimo: `https://optimo.ch/typefaces/[slug]`
   - Darden Studio: `https://www.dardenstudio.com/[slug]` (no `/typefaces/` prefix)
   - Velvetyne: `https://velvetyne.fr/fonts/[slug]/`
   - Latinotype: `https://www.latinotype.com/[slug]`
   - F37: `https://f37foundry.com/fonts/[slug]` or `/fonts/f37-[slug]`

   Even with these patterns, slugs and collection structures vary — always verify with a single WebSearch like `[typeface name] [foundry name]` before sending. If WebSearch returns the right page in the top results, use that URL. If not, fall through to rule 4.

3. **For every other foundry** — including Hoefler & Co, Schick Toikka, Sudtipos, Darden Studio, F37, Storm Type, Optimo, TypeTogether, Future Fonts, Latinotype, Commercial Type, Commercial Classics, exljbris, and any foundry not explicitly named above — assume nothing about the URL pattern. Always verify with a WebSearch like `[typeface name] [foundry name]` before including a link. Take the foundry-domain result from the top of the SERP.

4. **If verification fails or returns no clear result**, do not invent a URL. Output the typeface line as `[Name] — [foundry homepage] (search "[Name]")`. The user will accept the search-hint fallback. They will not accept 404s.

5. **For Adobe Fonts entries** (Linotype Didot, Trajan, Optima, Freight Big, etc.), use `https://fonts.adobe.com/fonts/[slug]` and verify with WebSearch — Adobe slugs are reasonably predictable but not always.

When generating a list of 10 or 20 candidates, batch the WebSearches in parallel. The verification adds a few seconds; sending 404s costs trust.

When in doubt, the priority order is: verified deep link > foundry homepage with search hint > nothing. Never send a constructed-but-unverified link as if it were correct.

### When to flag licensing

Brief mentions: app embedding, broadcast, large pageviews, multi-brand use, server-side rendering. Note that licensing varies by foundry and may need a separate enquiry. Don't quote prices — they change.

### Output format

**Default to a flat list of 10 typefaces. Name and link only. No reasoning, no descriptions, no foundry tags, no headings.** Love & Logic wants to scan and click, not read.

The format is exactly:

```
1. [Typeface name] — [direct link to typeface page]
2. [Typeface name] — [direct link to typeface page]
3. [Typeface name] — [direct link to typeface page]
...
10. [Typeface name] — [direct link to typeface page]
```

Always exactly 10. Rank them in order of fit, best first. Pick from Love & Logic's foundries first (Best tier first, then OkayGood + loose), top up with Google Fonts/Fontshare picks if budget signals were given, and only include outside-list picks if her list genuinely has nothing close — in which case prefix the line with `(outside list)`.

If the brief is for a system (display + text + mono), still return 10 total but cover the roles: e.g. 5 display, 4 text, 1 mono. Don't label the roles in the output unless asked.

**Only deviate from this format if Love & Logic explicitly asks for more — "tell me why", "explain the picks", "show pairings", "give me a system breakdown".** Then expand into reasoning, letterform features, pairing logic and licensing notes.

For identification (image input), default to:

```
**Most likely: [Typeface name] — [direct link]**

Close alternatives:
1. [Name] — [link]
2. [Name] — [link]
...
9. [Name] — [link]

Confidence: [High / Medium / Low / Insufficient — recommend Identifont or WhatTheFont]
```

That's the most-likely identification plus 9 close alternatives, totalling 10 candidates.

If asked "why" or "explain", expand into letterform-level reasoning citing specific glyphs (`a`, `g`, `e`, `R`, `Q`, `M`, `t`, `&`).

### Things to avoid

- Don't recommend fonts without naming the foundry and giving a URL.
- Don't recommend a font you can't justify with reference to letterform features. "It feels modern" is not a reason. "Low contrast, generous x-height, single-storey g, geometric construction" is a reason.
- Don't list every foundry that has a serif. Pick a small set that actually fits.
- Don't pad the answer. Love & Logic has read enough font recommendations to know filler when she sees it.
- Don't invent typefaces. If you can't recall a specific named font in a foundry, suggest the foundry generally and recommend Love & Logic browse it directly.
- Don't quote prices.
- Don't claim something is in Love & Logic's list when it isn't. Cross-check `references/foundries.json`.

## File structure

```
font-finder/
├── SKILL.md (this file)
└── references/
    ├── typography.md     ← Read first. Anatomy, classification, mood, pairings, ID checklist.
    ├── foundries.md      ← Human-readable foundry list with tiers and types.
    └── foundries.json    ← Structured foundry data for programmatic filtering.
```

## Workflow checklist

Every time you use this skill:

1. Read `references/typography.md` (skim the relevant sections).
2. If recommending, read or grep `references/foundries.json` to confirm what's available.
3. Translate the input (image features or brief words) into typographic features.
4. Propose options grounded in those features, using Love & Logic's tier order.
5. Justify each pick by citing letterform features.
6. Flag confidence and licensing where relevant.

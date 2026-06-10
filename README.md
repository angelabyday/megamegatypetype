# MegaMegaTypeType

A filterable directory of 638 typefaces from independent type foundries, plus a brief-to-fonts mode powered by Claude.

## Run it

```bash
npm install
cp .env.example .env.local   # then paste your real Anthropic API key
npm run dev
```

Open http://localhost:3000.

`ANTHROPIC_API_KEY` is only needed for brief mode (`/brief`); the directory and detail pages work without it.

## Build

```bash
npm run build
npm start
```

The build statically generates every typeface and foundry page (around 660 pages).

## Pages

- `/` — directory with filters (category, foundry, tier, features), search and sort
- `/t/[foundry]/[typeface]` — typeface detail, linking out to the foundry
- `/foundry/[foundry]` — all indexed typefaces from one foundry
- `/brief` — describe a project, get 10 ranked matches from Claude
- `/about` — what this is

## What's here

- `SPEC.md` — what to build, what's out of scope
- `CLAUDE.md` — house rules and the data schema
- `data/` — 13 JSON files (one per foundry) plus the 222-foundry list
- `docs/` — typography reference, the original skill logic and eval fixtures
- `app/`, `components/`, `lib/` — the Next.js app

## Deploy

Hosted on Vercel. Set `ANTHROPIC_API_KEY` in the Vercel project settings; everything else is static.

## Data refresh

When the index needs updating (new foundry releases), the scraping scripts that built these JSON files live in the original `font-finder` skill folder. The plan is to run them monthly as a scheduled task — see the SPEC.md backlog.

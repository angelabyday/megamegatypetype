// Index all Google Fonts via the Google Fonts API + Claude for descriptions/tags.
// Specimens are not auto-captured; run index-foundry.mjs --foundry google-fonts --specimens-only after.
//
// Usage:
//   node scripts/index-google-fonts.mjs
//   node scripts/index-google-fonts.mjs --limit 50    # dev/test: first N fonts
//   node scripts/index-google-fonts.mjs --resume      # skip already-indexed fonts (default)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = join(root, "data", "typefaces-google-fonts.json");

// Load .env.local
try {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1 || line.trimStart().startsWith("#")) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const MODEL = process.env.INDEX_MODEL ?? "claude-sonnet-4-6";
const BATCH_SIZE = 8;

const CATEGORY_MAP = {
  "serif": "serif",
  "sans-serif": "sans-serif",
  "display": "display",
  "handwriting": "script",
  "monospace": "mono",
};

const SUBSET_TO_LANG = {
  "latin": "Latin",
  "latin-ext": "Latin Extended",
  "cyrillic": "Cyrillic",
  "cyrillic-ext": "Cyrillic Extended",
  "greek": "Greek",
  "greek-ext": "Greek Extended",
  "devanagari": "Devanagari",
  "arabic": "Arabic",
  "hebrew": "Hebrew",
  "vietnamese": "Vietnamese",
  "thai": "Thai",
  "korean": "Korean",
  "chinese-simplified": "Chinese Simplified",
  "chinese-traditional": "Chinese Traditional",
  "japanese": "Japanese",
};

const WEIGHT_NAMES = {
  "100": "Thin", "200": "ExtraLight", "300": "Light",
  "regular": "Regular", "400": "Regular",
  "500": "Medium", "600": "SemiBold", "700": "Bold",
  "800": "ExtraBold", "900": "Black",
};

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function parseVariants(variants) {
  const weights = new Set();
  let hasItalic = false;
  for (const v of variants) {
    if (v.includes("italic")) hasItalic = true;
    const num = v.replace("italic", "").trim() || "regular";
    if (WEIGHT_NAMES[num]) weights.add(WEIGHT_NAMES[num]);
  }
  return { weights: [...weights], hasItalic };
}

async function main() {
  const argv = process.argv.slice(2);
  const limitArg = argv.indexOf("--limit");
  const limit = limitArg >= 0 ? parseInt(argv[limitArg + 1]) : null;

  const gfKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!gfKey) { console.error("GOOGLE_FONTS_API_KEY not set in .env.local"); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

  console.log("Fetching Google Fonts catalogue...");
  const apiRes = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${gfKey}&sort=alpha`);
  if (!apiRes.ok) { console.error(`API error: ${apiRes.status} ${apiRes.statusText}`); process.exit(1); }
  const { items } = await apiRes.json();

  const allFonts = limit ? items.slice(0, limit) : items;
  console.log(`${allFonts.length} fonts from API`);

  const existing = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, "utf8")) : [];
  const indexed = new Set(existing.map((e) => e.name));
  const entries = [...existing];

  const toIndex = allFonts.filter((f) => !indexed.has(f.family));
  console.log(`${toIndex.length} to index, ${existing.length} already done\n`);

  if (toIndex.length === 0) { console.log("Nothing to do."); return; }

  const client = new Anthropic();
  let errorCount = 0;

  for (let i = 0; i < toIndex.length; i += BATCH_SIZE) {
    const batch = toIndex.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toIndex.length / BATCH_SIZE);
    process.stdout.write(`Batch ${batchNum}/${totalBatches}: `);

    const batchMeta = batch.map((f) => {
      const { weights, hasItalic } = parseVariants(f.variants);
      const languages = (f.subsets || []).map((s) => SUBSET_TO_LANG[s] || s).filter(Boolean);
      const category = CATEGORY_MAP[f.category] || "display";
      return { name: f.family, category, weights, hasItalic, languages };
    });

    const prompt = `You are classifying Google Fonts typefaces for a curated type directory. For each font, return structured JSON.

For each font provide:
- subcategory: specific style (e.g. "geometric sans", "transitional serif", "display script", "brush script", "rounded sans")
- classification_notes: 1-2 sentences on design characteristics
- designer: designer name if well-known, otherwise null
- year: year first released if well-known, otherwise null
- tags: 3-8 tags from this list only: display, editorial, branding, headline, body, text, ui, screen, coding, geometric, humanist, grotesque, swiss, neutral, expressive, decorative, retro, vintage, revival, high-contrast, rounded, industrial, calligraphic, stencil, transitional, modular, playful, friendly, variable, wide, condensed, monospaced, slab, serif, sans-serif, script, blackletter, bold, clean, workhorse, system, open-source, free, multilingual, poster, signage, packaging, fashion, technical
- summary: 1 sentence, plain British English, confident and direct — what makes this typeface distinctive
- description: 2-3 sentences, plain British English — expand on the summary, mention specific use cases
- tier: "okay" for quality or popular fonts, "loose" for novelty/low-quality/one-trick fonts
- has_condensed: true if it has condensed or narrow variants
- has_mono: true if it has a monospace variant

Fonts:
${batchMeta.map((f, idx) => `${idx + 1}. "${f.name}" — ${f.category}, weights: ${f.weights.join(", ") || "Regular"}, scripts: ${f.languages.slice(0, 3).join(", ") || "Latin"}`).join("\n")}

Return a JSON array of exactly ${batch.length} objects in the same order. Keys: subcategory, classification_notes, designer, year, tags, summary, description, tier, has_condensed, has_mono.`;

    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = msg.content[0].text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`\n  No JSON array in response`);
        errorCount++;
        continue;
      }

      const results = JSON.parse(jsonMatch[0]);

      for (let j = 0; j < batch.length; j++) {
        const f = batch[j];
        const r = results[j];
        if (!r) continue;

        const { weights, hasItalic } = parseVariants(f.variants);
        const languages = (f.subsets || []).map((s) => SUBSET_TO_LANG[s] || s).filter(Boolean);
        const category = CATEGORY_MAP[f.category] || "display";

        const tags = Array.from(new Set([...(r.tags || []), "free", "open-source"]));

        entries.push({
          name: f.family,
          foundry: "Google Fonts",
          url: `https://fonts.google.com/specimen/${f.family.replace(/ /g, "+")}`,
          designer: r.designer || null,
          year: r.year || null,
          category,
          subcategory: r.subcategory || "",
          classification_notes: r.classification_notes || "",
          weights,
          optical_sizes_or_widths: [],
          subfamilies: [],
          has_condensed: r.has_condensed ?? false,
          has_italic: hasItalic,
          has_mono: r.has_mono ?? false,
          languages,
          tier: r.tier || "okay",
          type: "free",
          tags,
          summary: r.summary || "",
          description: r.description || "",
          foundry_blurb: "",
        });

        process.stdout.write(`${f.family} `);
      }

      process.stdout.write("\n");
      writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + "\n");
    } catch (err) {
      console.error(`\n  Error: ${err.message}`);
      errorCount++;
    }

    if (i + BATCH_SIZE < toIndex.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log(`\nDone. ${entries.length} fonts in ${OUT_PATH}`);
  if (errorCount > 0) console.log(`${errorCount} batches failed — re-run to retry.`);
}

main().catch((err) => { console.error(err); process.exit(1); });

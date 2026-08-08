// Re-run the Claude vision check against existing specimen images, tiered
// into three outcomes rather than a binary keep/drop:
//
//   ok         - clear, legible specimen. No action.
//   to_improve - letterforms are visible and judgeable, just not shown at
//                their best (cropped-but-readable, marketing copy instead of
//                a pangram, busy composition, thin one-word specimen). Left
//                on disk as-is - these are a polish backlog, not a defect.
//   bad        - the typeface genuinely cannot be judged from this image:
//                cookie/consent banners, error/bot-check pages, blank
//                captures, no letterforms visible at all, or a duplicate
//                image reused across typefaces in the same foundry. Deleted
//                from public/specimens/ and dropped from lib/specimens.json
//                so a normal `node scripts/fetch-specimens.mjs --foundry
//                <slug>` run re-fetches it.
//
// Originally written for the 2026-08-05 API billing outage, when
// validateSpecimen()'s vision call failed on every image and the pipeline's
// "vision failure never blocks the pipeline" fallback silently accepted
// everything on heuristics alone. Generalised afterward for periodic
// full-catalogue rechecks. The binary version of this script's prompt
// ("is this usable, yes/no") ran once against 48 foundries and had a ~50%
// drop rate with at least one confirmed false positive (a fully legible
// specimen rejected only because it showed marketing copy instead of a
// pangram) - the three-way split exists specifically to stop that: only
// `bad` is destructive, `to_improve` just gets logged.
//
// Run: node scripts/revalidate-specimens.mjs [--model claude-haiku-4-5] [--foundries slug1,slug2,...]
//
// Writes scratch output to stdout (KEEP/IMPROVE/DROP per image, summary at
// the end) and appends every to_improve verdict to
// docs/specimens-to-improve.json (foundrySlug/typefaceSlug -> reason) so the
// backlog survives across runs instead of living only in a terminal log.

import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens");
const MANIFEST = join(root, "lib", "specimens.json");
const TO_IMPROVE = join(root, "docs", "specimens-to-improve.json");

const modelFlag = process.argv.indexOf("--model");
const VISION_MODEL = modelFlag > -1 ? process.argv[modelFlag + 1] : "claude-haiku-4-5";
const foundriesFlag = process.argv.indexOf("--foundries");
const foundriesOverride = foundriesFlag > -1 ? process.argv[foundriesFlag + 1].split(",") : null;

if (!process.env.ANTHROPIC_API_KEY && existsSync(join(root, ".env.local"))) {
  const env = readFileSync(join(root, ".env.local"), "utf8");
  const m = env.match(/^ANTHROPIC_API_KEY=["']?([^"'\n]+)/m);
  if (m) process.env.ANTHROPIC_API_KEY = m[1];
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("No ANTHROPIC_API_KEY found (env or .env.local). Aborting.");
  process.exit(1);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic();

// Mirrors slugify in lib/typefaces.ts / fetch-specimens.mjs.
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Foundries fetched during the 2026-08-05 outage window (Zarma Type ran
// clean; 403TF onward all hit the credit-balance error on every vision
// call). Default scope when --foundries isn't passed.
const AFFECTED = [
  "403tf", "amorfa-type", "aiyari-studio", "glyphminds-studios",
  "terminal-design", "mvb-fonts", "typeparties", "dirty-line-studio",
  "truetype", "rellence", "bb-bureau", "ragamkata-studio", "fateh-lab",
  "bagerich-type-foundry", "cotype-foundry", "philatype", "any-type-foundry",
  "the-native-saint-club", "yenty-jap-co", "retrosupply-co",
  "lazydogs-typefoundry", "canada-type",
];

function loadTypefaceNames(foundrySlug) {
  const file = join(root, "data", `typefaces-${foundrySlug}.json`);
  if (!existsSync(file)) return new Map();
  const entries = JSON.parse(readFileSync(file, "utf8"));
  const map = new Map();
  for (const t of entries) map.set(slugify(t.name), { name: t.name, foundry: t.foundry });
  return map;
}

async function checkImage(webpBuf, name, foundry) {
  const res = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 150,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/webp", data: webpBuf.toString("base64") } },
        {
          type: "text",
          text:
            `This image was captured from ${foundry}'s website for the typeface "${name}". ` +
            `Classify it into exactly one tier:\n\n` +
            `"bad" - the typeface genuinely CANNOT be judged from this image. Use for: ` +
            `cookie/consent banners or walls, Cloudflare or human-verification pages, error pages ` +
            `(404/500), "coming soon" or parked-domain pages, blank or near-blank captures, or ` +
            `images where NO letterforms are visible at all (a bare photo, a logo mark, a diagram, ` +
            `a product shot with no type on it).\n\n` +
            `"to_improve" - letterforms ARE visible and you genuinely CAN judge the typeface from ` +
            `them, but the shot isn't ideal: cropped or cut off but still legible, type partly ` +
            `obscured but still readable, a busy or awkward composition, marketing copy shown ` +
            `instead of a proper pangram/alphabet (fine if it's still fully legible), or a thin ` +
            `specimen of only one or two words that are nonetheless clearly legible.\n\n` +
            `"ok" - a clear, well-composed, legible specimen.\n\n` +
            `The bar for "bad" is narrow: can you actually see and read real letterforms of this ` +
            `typeface, clearly enough to judge it? If yes, it is NOT bad, even if the composition, ` +
            `crop, or copy choice isn't ideal - that's "to_improve". A deliberately experimental or ` +
            `distorted-looking typeface showing its genuine character legibly is "ok" or ` +
            `"to_improve", never "bad" for that reason alone.\n\n` +
            `Reply with JSON only: {"tier": "bad"|"to_improve"|"ok", "reason": "<max 8 words>"}`,
        },
      ],
    }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  const tier = ["bad", "to_improve", "ok"].includes(parsed.tier) ? parsed.tier : "ok";
  return { tier, reason: parsed.reason ?? "unknown" };
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const toImprove = existsSync(TO_IMPROVE) ? JSON.parse(readFileSync(TO_IMPROVE, "utf8")) : {};

let checked = 0, ok = 0, improve = 0, bad = 0;
const badList = [];
const improveList = [];

for (const foundrySlug of foundriesOverride ?? AFFECTED) {
  const dir = join(OUT_DIR, foundrySlug);
  if (!existsSync(dir)) continue;
  const names = loadTypefaceNames(foundrySlug);
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

  for (const file of files) {
    const slug = file.replace(/\.webp$/, "");
    const info = names.get(slug) ?? { name: slug, foundry: foundrySlug };
    const path = join(dir, file);
    const buf = readFileSync(path);
    const key = `${foundrySlug}/${slug}`;
    checked++;
    try {
      const verdict = await checkImage(buf, info.name, info.foundry);
      if (verdict.tier === "ok") {
        ok++;
        delete toImprove[key];
        console.log(`KEEP ${key}`);
      } else if (verdict.tier === "to_improve") {
        improve++;
        improveList.push(`${key}: ${verdict.reason}`);
        toImprove[key] = verdict.reason;
        console.log(`IMPROVE ${key} (${verdict.reason})`);
      } else {
        bad++;
        badList.push(`${key}: ${verdict.reason}`);
        delete toImprove[key];
        unlinkSync(path);
        delete manifest[key];
        // Persist immediately, not just at the end - an interrupted run
        // should not leave a manifest claiming a deleted file still exists.
        writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0) + "\n");
        console.log(`DROP ${key} (${verdict.reason})`);
      }
    } catch (err) {
      console.error(`ERROR checking ${key}: ${err.message}`);
    }
  }
}

writeFileSync(TO_IMPROVE, JSON.stringify(toImprove, null, 2) + "\n");

console.log(`\nDone. checked ${checked}, ok ${ok}, to_improve ${improve}, bad ${bad}`);
if (badList.length) {
  console.log("\nBad (deleted, will be re-fetched by a normal fetch-specimens.mjs run):");
  for (const r of badList) console.log(`  ${r}`);
}
if (improveList.length) {
  console.log("\nTo improve (left on disk, logged to docs/specimens-to-improve.json):");
  for (const r of improveList) console.log(`  ${r}`);
}

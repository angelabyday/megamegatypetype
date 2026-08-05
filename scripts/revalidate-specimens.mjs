// One-off: re-run the Claude vision check against specimen images that were
// accepted during an Anthropic API billing outage (2026-08-05), when
// validateSpecimen()'s vision call failed on every image and the pipeline's
// "vision failure never blocks the pipeline" fallback silently accepted
// everything on heuristics alone (size/blank/dedup-hash only).
//
// For each affected foundry, re-checks every existing specimen file with the
// same vision prompt fetch-specimens.mjs uses. Anything that fails is deleted
// from public/specimens/ and dropped from lib/specimens.json, so a normal
// `node scripts/fetch-specimens.mjs --foundry <slug>` run will re-fetch it
// properly (with a working vision check this time).
//
// Run: node scripts/revalidate-specimens.mjs [--model claude-haiku-4-5]

import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens");
const MANIFEST = join(root, "lib", "specimens.json");

const modelFlag = process.argv.indexOf("--model");
const VISION_MODEL = modelFlag > -1 ? process.argv[modelFlag + 1] : "claude-haiku-4-5";

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

// Foundries fetched during the outage window (Zarma Type ran clean; 403TF
// onward all hit the credit-balance error on every vision call).
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
    max_tokens: 100,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/webp", data: webpBuf.toString("base64") } },
        {
          type: "text",
          text:
            `This image was captured from ${foundry}'s website for the typeface "${name}". ` +
            `Is it a usable specimen image, i.e. letterforms or type shown clearly as the main subject? ` +
            `Answer no for: cookie/consent banners or walls, Cloudflare or human-verification pages, ` +
            `error pages, blank or near-blank pages, language-coverage maps, photos without prominent type, ` +
            `pages where the specimen area failed to render. ` +
            `Reply with JSON only: {"ok": true|false, "reason": "<max 6 words>"}`,
        },
      ],
    }],
  });
  const text = res.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
  return { ok: parsed.ok === true, reason: parsed.reason ?? "unknown" };
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

let checked = 0, kept = 0, removed = 0;
const removedList = [];

for (const foundrySlug of AFFECTED) {
  const dir = join(OUT_DIR, foundrySlug);
  if (!existsSync(dir)) continue;
  const names = loadTypefaceNames(foundrySlug);
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));

  for (const file of files) {
    const slug = file.replace(/\.webp$/, "");
    const info = names.get(slug) ?? { name: slug, foundry: foundrySlug };
    const path = join(dir, file);
    const buf = readFileSync(path);
    checked++;
    try {
      const verdict = await checkImage(buf, info.name, info.foundry);
      if (verdict.ok) {
        kept++;
      } else {
        removed++;
        removedList.push(`${foundrySlug}/${slug}: ${verdict.reason}`);
        unlinkSync(path);
        const key = `${foundrySlug}/${slug}`;
        delete manifest[key];
      }
      console.log(`${verdict.ok ? "KEEP" : "DROP"} ${foundrySlug}/${slug}${verdict.ok ? "" : ` (${verdict.reason})`}`);
    } catch (err) {
      console.error(`ERROR checking ${foundrySlug}/${slug}: ${err.message}`);
    }
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

console.log(`\nDone. checked ${checked}, kept ${kept}, removed ${removed}`);
if (removedList.length) {
  console.log("Removed (will be re-fetched by a normal fetch-specimens.mjs run):");
  for (const r of removedList) console.log(`  ${r}`);
}

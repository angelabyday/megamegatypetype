// Harvest a specimen image for every typeface in data/typefaces-*.json.
// Pass 1 takes the page's og:image (discarding site-generic share cards);
// pass 2 screenshots the page with Playwright for whatever remains.
// Output: public/specimens/[foundrySlug]/[slug].webp + lib/specimens.json.
//
// Run locally: node scripts/fetch-specimens.mjs [--screenshots-only-missing]
// Never runs on Vercel.

import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens");
const MANIFEST = join(root, "lib", "specimens.json");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WIDTH = 640;
const DOMAIN_DELAY_MS = 1500;
const DOMAIN_CONCURRENCY = 4;

// Mirrors slugify in lib/typefaces.ts.
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mirrors lib/foundry-map.ts.
const FOUNDRY_SLUGS = {
  "atipo foundry": "atipo-foundry",
  "Commercial Type": "commercial-type",
  "Dalton Maag": "dalton-maag",
  "Dinamo Typefaces": "dinamo-typefaces",
  "Displaay Type Foundry": "displaay-type-foundry",
  "F37 Foundry": "f37-foundry",
  "Grilli Type": "grilli-type",
  "Hoefler & Co": "hoefler-co",
  "Klim Type Foundry": "klim-type-foundry",
  Optimo: "optimo",
  "Pangram Pangram Foundry": "pangram-pangram-foundry",
  "Schick Toikka": "schick-toikka",
  Sociotype: "sociotype",
  Lineto: "lineto",
  "Swiss Typefaces": "swiss-typefaces",
  "Production Type": "production-type",
  Newlyn: "newlyn",
  Typotheque: "typotheque",
  "OH no Type": "oh-no-type",
  Fontwerk: "fontwerk",
  CAST: "cast",
  Camelot: "camelot",
  Extraset: "extraset",
  Fatype: "fatype",
  NaN: "nan",
  Signal: "signal",
  "Blaze Type": "blaze-type",
  "a.Foundry": "a-foundry",
  AllCaps: "allcaps",
  Arillatype: "arillatype",
  "Faire Type": "faire-type",
  "British Standard Type": "british-standard-type",
  "OTT Foundry": "ott-foundry",
  "Bureau Brut": "bureau-brut",
  "A Type of Amigo": "a-type-of-amigo",
  Bastarda: "bastarda",
  "Interval Type": "interval-type",
  "Due Studio": "due-studio",
  Typespec: "typespec",
};

const COOKIE_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  '[class*="cookie"] button[class*="accept"]',
  '[id*="cookie"] button[class*="accept"]',
  'button[aria-label*="ccept"]',
  ".cc-allow",
  ".cky-btn-accept",
];

function loadTypefaces() {
  const dataDir = join(root, "data");
  const files = readdirSync(dataDir).filter((f) => f.startsWith("typefaces-") && f.endsWith(".json"));
  return files.flatMap((f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"))).map((t) => ({
    name: t.name,
    url: t.url,
    foundrySlug: FOUNDRY_SLUGS[t.foundry],
    slug: slugify(t.name),
  }));
}

function outPath(t) {
  return join(OUT_DIR, t.foundrySlug, `${t.slug}.webp`);
}

async function saveWebp(buffer, t) {
  mkdirSync(join(OUT_DIR, t.foundrySlug), { recursive: true });
  await sharp(buffer).resize({ width: WIDTH, withoutEnlargement: false }).webp({ quality: 70 }).toFile(outPath(t));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init = {}, retries = 2) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,image/*,*/*" },
        signal: AbortSignal.timeout(20000),
        ...init,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i >= retries) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

function extractOgImage(html, pageUrl) {
  const metas = html.match(/<meta[^>]+>/gi) ?? [];
  for (const key of ["og:image", "twitter:image"]) {
    for (const m of metas) {
      if (!new RegExp(`(property|name)=["']${key}(:secure_url)?["']`, "i").test(m)) continue;
      const content = m.match(/content=["']([^"']+)["']/i);
      if (content && content[1]) {
        const raw = content[1].replace(/&amp;/g, "&").trim();
        try {
          return new URL(raw, pageUrl).href;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Group work by domain so each domain is hit serially with a delay.
function groupByDomain(typefaces) {
  const groups = new Map();
  for (const t of typefaces) {
    const domain = new URL(t.url).hostname;
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(t);
  }
  return groups;
}

async function runPerDomain(groups, worker) {
  const domains = [...groups.keys()];
  let cursor = 0;
  async function lane() {
    while (cursor < domains.length) {
      const domain = domains[cursor++];
      for (const t of groups.get(domain)) {
        await worker(t);
        await sleep(DOMAIN_DELAY_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOMAIN_CONCURRENCY, domains.length) }, lane));
}

async function main() {
  const foundryFlag = process.argv.indexOf("--foundry");
  const onlyFoundry = foundryFlag > -1 ? process.argv[foundryFlag + 1] : null;

  const typefaces = loadTypefaces().filter((t) => {
    if (!t.foundrySlug) {
      console.warn(`SKIP unknown foundry for ${t.name}`);
      return false;
    }
    return onlyFoundry ? t.foundrySlug === onlyFoundry : true;
  });

  const onlyMissing = process.argv.includes("--screenshots-only-missing");
  const stats = { og: 0, screenshot: 0, cached: 0, miss: [] };

  // ---- Pass 1: collect og:image URLs ----
  const ogUrls = new Map(); // typeface -> og url
  if (!onlyMissing) {
    await runPerDomain(groupByDomain(typefaces), async (t) => {
      if (existsSync(outPath(t))) {
        stats.cached++;
        return;
      }
      try {
        const res = await fetchWithRetry(t.url);
        const html = await res.text();
        const og = extractOgImage(html, res.url || t.url);
        if (og) ogUrls.set(t, og);
        console.log(`og-scan ${t.foundrySlug}/${t.slug} -> ${og ?? "none"}`);
      } catch (err) {
        console.warn(`og-scan FAIL ${t.foundrySlug}/${t.slug}: ${err.message}`);
      }
    });

    // Discard generic share cards: same image URL on >2 typefaces of one foundry.
    const counts = new Map();
    for (const [t, og] of ogUrls) {
      const key = `${t.foundrySlug}|${og}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [t, og] of [...ogUrls]) {
      if (counts.get(`${t.foundrySlug}|${og}`) > 2) ogUrls.delete(t);
    }

    // Download the survivors.
    await runPerDomain(groupByDomain([...ogUrls.keys()]), async (t) => {
      try {
        const res = await fetchWithRetry(ogUrls.get(t));
        const buf = Buffer.from(await res.arrayBuffer());
        await saveWebp(buf, t);
        stats.og++;
        console.log(`og-image ${t.foundrySlug}/${t.slug} saved`);
      } catch (err) {
        console.warn(`og-image FAIL ${t.foundrySlug}/${t.slug}: ${err.message}`);
      }
    });
  }

  // ---- Pass 2: screenshot whatever is still missing ----
  const missing = typefaces.filter((t) => !existsSync(outPath(t)));
  console.log(`\nScreenshot pass: ${missing.length} pages\n`);
  if (missing.length > 0) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      userAgent: UA,
      deviceScaleFactor: 1,
    });

    await runPerDomain(groupByDomain(missing), async (t) => {
      const page = await context.newPage();
      try {
        await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        for (const sel of COOKIE_SELECTORS) {
          await page
            .locator(sel)
            .first()
            .click({ timeout: 500 })
            .catch(() => {});
        }
        await page.waitForTimeout(1500);
        const buf = await page.screenshot({ type: "png" });
        await saveWebp(buf, t);
        stats.screenshot++;
        console.log(`screenshot ${t.foundrySlug}/${t.slug} saved`);
      } catch (err) {
        stats.miss.push(`${t.foundrySlug}/${t.slug}`);
        console.warn(`screenshot FAIL ${t.foundrySlug}/${t.slug}: ${err.message}`);
      } finally {
        await page.close();
      }
    });

    await browser.close();
  }

  // ---- Manifest ----
  const manifest = {};
  for (const t of typefaces) {
    if (existsSync(outPath(t))) manifest[`${t.foundrySlug}/${t.slug}`] = true;
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0) + "\n");

  console.log(
    `\nDone. og:image ${stats.og}, screenshots ${stats.screenshot}, already present ${stats.cached}, ` +
      `misses ${stats.miss.length}, manifest entries ${Object.keys(manifest).length}/${typefaces.length}`
  );
  if (stats.miss.length) console.log("Missed:", stats.miss.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

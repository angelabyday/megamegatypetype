// Fetches og:image (or screenshot) for each foundry homepage.
// Outputs to public/foundry-images/[slug].webp

import { chromium } from "playwright";
import { mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "foundry-images");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const WIDTH = 640, HEIGHT = 400;
const MIN_SIZE = 5000;

mkdirSync(OUT_DIR, { recursive: true });

// Parse FOUNDRIES from the TypeScript source (Node 24 type stripping)
const src = (await import("node:fs")).readFileSync(
  new URL("../lib/foundry-map.ts", import.meta.url),
  "utf8"
);
// Extract slug+homepage pairs with regex
const FOUNDRIES = [...src.matchAll(/\{\s*name:\s*"[^"]*",\s*slug:\s*"([^"]*)",\s*homepage:\s*"([^"]*)"/g)]
  .map(m => ({ slug: m[1], homepage: m[2] }));

function extractOgImage(html, base) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).href; } catch { return null; }
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return r;
    } catch (e) {
      if (i === retries) throw e;
    }
  }
}

async function saveWebp(buffer, outFile) {
  await sharp(buffer)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 75 })
    .toFile(outFile);
  return statSync(outFile).size;
}

const force = process.argv.includes("--force");
const slugFilter = process.argv.find(a => a.startsWith("--slugs="))?.split("=")[1]?.split(",");
const foundriesToRun = slugFilter ? FOUNDRIES.filter(f => slugFilter.includes(f.slug)) : FOUNDRIES;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });

const saved = [], failed = [];

for (const foundry of foundriesToRun) {
  const outFile = join(OUT_DIR, `${foundry.slug}.webp`);
  if (!force && existsSync(outFile) && statSync(outFile).size >= MIN_SIZE) {
    console.log(`skip ${foundry.slug}`);
    saved.push(foundry.slug);
    continue;
  }

  const page = await ctx.newPage();
  let done = false;
  try {
    await page.goto(foundry.homepage, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    // 1. og:image
    const html = await page.content();
    const og = extractOgImage(html, foundry.homepage);
    if (og) {
      try {
        const res = await fetchWithRetry(og);
        const buf = Buffer.from(await res.arrayBuffer());
        const size = await saveWebp(buf, outFile);
        if (size >= MIN_SIZE) {
          console.log(`og ${foundry.slug} (${size}b)`);
          saved.push(foundry.slug);
          done = true;
        }
      } catch {}
    }

    // 2. Screenshot fallback
    if (!done) {
      const buf = await page.screenshot({ type: "png" });
      const size = await saveWebp(buf, outFile);
      console.log(`screenshot ${foundry.slug} (${size}b)`);
      saved.push(foundry.slug);
      done = true;
    }
  } catch (e) {
    console.warn(`FAIL ${foundry.slug}: ${e.message}`);
    failed.push(foundry.slug);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nDone. ${saved.length} saved, ${failed.length} failed.`);
if (failed.length) console.log("Failed:", failed.join(", "));

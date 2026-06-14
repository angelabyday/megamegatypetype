// Fetches per-font images from the OH no Type listing page rather than detail pages.
// Uses per-card screenshot clips to get font-specific images.

import { chromium } from "playwright";
import { readdirSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens", "oh-no-type");
const MANIFEST = join(root, "lib", "specimens.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const WIDTH = 640, HEIGHT = 400;

function slugify(name) {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/['']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, deviceScaleFactor: 1 });
const page = await ctx.newPage();

console.log("Loading OH no Type fonts listing...");
await page.goto("https://ohnotype.co/fonts", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Dismiss cookies
try {
  const btns = await page.locator("button:visible").all();
  for (const btn of btns) {
    const t = (await btn.innerText().catch(() => "")).trim().toLowerCase();
    if (/accept|agree|ok|allow|got it|dismiss/.test(t)) { await btn.click().catch(() => {}); break; }
  }
} catch {}
await page.waitForTimeout(500);

// Debug: log page URL and sample links
const pageUrl = page.url();
console.log("Page URL:", pageUrl);
const sampleLinks = await page.evaluate(() =>
  [...document.querySelectorAll("a[href]")].slice(0, 20).map(a => a.getAttribute("href"))
);
console.log("Sample links:", sampleLinks);

// Load fonts from data file — use URL path to find correct card, slug for output file
const ohnoFonts = JSON.parse(readFileSync(join(root, "data", "typefaces-oh-no-type.json"), "utf8"));
const fonts = ohnoFonts.map(t => ({
  slug: slugify(t.name),
  urlPath: new URL(t.url).pathname, // e.g. "/fonts/covik" (may differ from slug)
}));
console.log(`\nFonts to fetch: ${fonts.map(f => f.slug).join(", ")}`);

// Scroll through entire page to trigger lazy loading
console.log("Scrolling to load lazy content...");
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y <= pageHeight; y += 400) {
  await page.evaluate((yPos) => window.scrollTo(0, yPos), y);
  await page.waitForTimeout(150);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const slugFilter = process.argv.find(a => a.startsWith("--slugs="))?.split("=")[1]?.split(",");
const fontsToRun = slugFilter ? fonts.filter(f => slugFilter.includes(f.slug)) : fonts;

const saved = [];
const failed = [];

for (const { slug, urlPath } of fontsToRun) {
  const outFile = join(OUT_DIR, `${slug}.webp`);

  // Cards are a.families__family-link with full href URLs
  const fullUrl = `https://ohnotype.co${urlPath}`;
  const selectors = [
    `a.families__family-link[href="${fullUrl}"]`,
    `a.families__family-link[href="${fullUrl}/"]`,
    `a[href="${fullUrl}"]`,
    `a[href="${fullUrl}/"]`,
  ];

  let done = false;
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      const count = await el.count().catch(() => 0);
      if (!count) continue;

      await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);

      const box = await el.boundingBox().catch(() => null);
      if (!box || box.width < 100 || box.height < 100) continue;

      const buf = await page.screenshot({
        clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height },
        type: "png",
      });
      await sharp(buf)
        .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
        .webp({ quality: 75 })
        .toFile(outFile);
      const size = statSync(outFile).size;
      if (size >= 5000) {
        console.log(`clip ${slug} saved (${size}b)`);
        saved.push(slug);
        done = true;
        break;
      }
    } catch (e) {
      // try next selector
    }
  }

  if (!done) {
    failed.push(slug);
    console.warn(`FAIL ${slug}`);
  }
}

await browser.close();

// Update manifest
const existing = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
for (const s of saved) existing[`oh-no-type/${s}`] = true;
for (const s of failed) existing[`oh-no-type/${s}`] = false;
writeFileSync(MANIFEST, JSON.stringify(existing, null, 0) + "\n");

console.log(`\nDone. ${saved.length} saved, ${failed.length} failed.`);
if (failed.length) console.log("Failed:", failed.join(", "));

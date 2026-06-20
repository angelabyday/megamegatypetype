// Retake HVD Fonts specimens using playwright-extra + stealth plugin to bypass Cloudflare.
// Run: node scripts/retake-hvd.mjs
// Test one: node scripts/retake-hvd.mjs --test
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

chromium.use(StealthPlugin());

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens", "hvd-fonts");
const MANIFEST = join(root, "lib", "specimens.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const W = 640, H = 400, MIN_SIZE = 5000;
const SKIP = /logo|icon|avatar|placeholder|sprite|flag|badge/i;

mkdirSync(OUT_DIR, { recursive: true });

function slugify(name) {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/['']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function saveWebp(buffer, outFile, position = "centre") {
  await sharp(buffer).resize(W, H, { fit: "cover", position }).webp({ quality: 75 }).toFile(outFile);
  return statSync(outFile).size;
}

async function fetchBuf(url) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// All HVD typefaces from data file
const { default: fs } = await import("node:fs");
const typefaces = JSON.parse(fs.readFileSync(join(root, "data", "typefaces-hvd-fonts.json"), "utf8"))
  .map(t => ({ name: t.name, url: t.url, slug: slugify(t.name) }));

const testMode = process.argv.includes("--test");
const todo = testMode ? typefaces.slice(0, 3) : typefaces;

console.log(`Running ${testMode ? "TEST (3 fonts)" : `ALL (${todo.length} fonts)`} with stealth\n`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  userAgent: UA,
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "Europe/London",
});

const results = { ok: [], blocked: [], failed: [] };

for (const t of todo) {
  const outFile = join(OUT_DIR, `${t.slug}.webp`);
  const page = await ctx.newPage();
  try {
    await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    // Check if still on a Cloudflare challenge/block page
    const title = await page.title();
    const isBlocked = /just a moment|attention required|cloudflare|access denied/i.test(title);
    if (isBlocked) {
      console.log(`BLOCKED ${t.slug} (title: "${title}")`);
      results.blocked.push(t.slug);
      continue;
    }

    // 1. Try largest landscape img
    const imgSrc = await page.evaluate((SKIP_RE) => {
      const skip = new RegExp(SKIP_RE);
      const candidates = [...document.querySelectorAll("img")].map(el => ({
        src: el.currentSrc || el.src,
        w: el.naturalWidth, h: el.naturalHeight,
      })).filter(c =>
        c.src && !c.src.startsWith("data:") && !/\.svg(\?|$)/i.test(c.src) &&
        !skip.test(c.src) && c.w >= 400 && c.h >= 150 && c.w / c.h >= 1.2
      ).sort((a, b) => b.w * b.h - a.w * a.h);
      return candidates[0]?.src ?? null;
    }, SKIP.source);

    if (imgSrc) {
      try {
        const buf = await fetchBuf(imgSrc);
        const size = await saveWebp(buf, outFile);
        if (size >= MIN_SIZE) {
          console.log(`img ${t.slug} (${size}b)`);
          results.ok.push(t.slug);
          continue;
        }
      } catch { /* fall through */ }
    }

    // 2. Screenshot
    const buf = await page.screenshot({ type: "png" });
    const size = await saveWebp(buf, outFile, "top");
    if (size === 8570) {
      // Exact same blocked-page size as before — still blocked
      fs.unlinkSync(outFile);
      console.log(`BLOCKED (screenshot) ${t.slug}`);
      results.blocked.push(t.slug);
    } else {
      console.log(`screenshot ${t.slug} (${size}b)`);
      results.ok.push(t.slug);
    }
  } catch (err) {
    console.warn(`FAIL ${t.slug}: ${err.message}`);
    results.failed.push(t.slug);
  } finally {
    await page.close();
  }
}

await browser.close();

// Update manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
for (const t of todo) {
  manifest[`hvd-fonts/${t.slug}`] = existsSync(join(OUT_DIR, `${t.slug}.webp`));
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, { separators: [",", ":"] }) + "\n");
// sharp fix: JSON.stringify second arg should be null for replacer
fs.writeFileSync(MANIFEST, JSON.stringify(manifest) + "\n");

console.log(`\nDone: ${results.ok.length} ok, ${results.blocked.length} blocked, ${results.failed.length} failed`);
if (results.blocked.length) console.log("Blocked:", results.blocked.join(", "));
if (results.failed.length) console.log("Failed:", results.failed.join(", "));

// Retake specimens for Nouvelle Noire "A." series typefaces.
// The original capture scrolled to a PDF download section instead of the type specimen.
// Fix: scroll to top, wait for the hero image, screenshot.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const W = 640, H = 400;

async function saveWebp(buffer, outFile) {
  await sharp(buffer)
    .resize(W, H, { fit: "cover", position: "top" })
    .webp({ quality: 75 })
    .toFile(outFile);
  console.log(`saved ${outFile}`);
}

const SPECIMENS = [
  { slug: "a-abf-silhouette", url: "https://nouvellenoire.ch/product/a-abf-silhouette/" },
  { slug: "a-abf-petit",      url: "https://nouvellenoire.ch/product/a-abf-petit/" },
  { slug: "a-poudre",         url: "https://nouvellenoire.ch/product/a-poudre/" },
  { slug: "a-coupe",          url: "https://nouvellenoire.ch/product/a-coupe-11/" },
  { slug: "a-abf-lineaire",   url: "https://nouvellenoire.ch/product/a-abf-lineaire/" },
  { slug: "a-izocel",         url: "https://nouvellenoire.ch/product/a-izocel/" },
  { slug: "a-ndebele",        url: "https://nouvellenoire.ch/product/a-ndebele/" },
  { slug: "a-ali",            url: "https://nouvellenoire.ch/product/a-ali/" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  userAgent: UA,
  deviceScaleFactor: 1,
});

const specimenDir = join(root, "public", "specimens", "nouvelle-noire");
mkdirSync(specimenDir, { recursive: true });

for (const { slug, url } of SPECIMENS) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // Scroll to top to get the type specimen hero, not the PDF section lower down
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const buf = await page.screenshot({ type: "png" });
    await saveWebp(buf, join(specimenDir, `${slug}.webp`));
  } catch (err) {
    console.warn(`FAIL ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log("Done.");

// One-off script to retake British Standard Type specimens + foundry image.
// BST pages: hero at top, then campaign images that are SVGs served via Prismic CDN.
// Strategy: find the 2nd large <img> on the page, scroll it into view, screenshot.
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
    .resize(W, H, { fit: "cover", position: "centre" })
    .webp({ quality: 75 })
    .toFile(outFile);
  console.log(`saved ${outFile}`);
}

async function scrollToSpecimen(page) {
  // BST: Campaign* SVGs show the font in use (large letterforms on grey background).
  // TypeSpecimen* SVGs are outline drawings — invisible on white background.
  // Take the 2nd large image (index 1): shows heavier weight specimen.
  await page.evaluate(() => {
    const all = [...document.querySelectorAll("img")]
      .filter(el => el.naturalWidth >= 600 && el.naturalHeight >= 150);
    const target = all[1] ?? all[0];
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top);
  });
}

const SPECIMENS = [
  { slug: "spyre",            url: "https://www.britishstandardtype.xyz/typefaces/spyre" },
  { slug: "spyre-epoch",      url: "https://www.britishstandardtype.xyz/typefaces/spyre-epoch" },
  { slug: "bst-bazaine",      url: "https://www.britishstandardtype.xyz/typefaces/bazaine" },
  { slug: "bst-bazaine-mono", url: "https://www.britishstandardtype.xyz/typefaces/bazaine-mono" },
  { slug: "bst-ritma",        url: "https://www.britishstandardtype.xyz/typefaces/ritma" },
  { slug: "bst-symbol-mono",  url: "https://www.britishstandardtype.xyz/typefaces/symbol-mono" },
];

const FOUNDRY_HOME = "https://www.britishstandardtype.xyz";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 960 },
  userAgent: UA,
  deviceScaleFactor: 1,
});

const specimenDir = join(root, "public", "specimens", "british-standard-type");
mkdirSync(specimenDir, { recursive: true });

for (const { slug, url } of SPECIMENS) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await scrollToSpecimen(page);
    await page.waitForTimeout(600);
    const buf = await page.screenshot({ type: "png" });
    await saveWebp(buf, join(specimenDir, `${slug}.webp`));
  } catch (err) {
    console.warn(`FAIL ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }
}

// Foundry image — homepage uses CSS backgrounds, no <img> tags.
// y=960 (1 viewport scroll) lands on the Spyre specimen section.
const foundryDir = join(root, "public", "foundry-images");
mkdirSync(foundryDir, { recursive: true });
{
  const page = await ctx.newPage();
  try {
    await page.goto(FOUNDRY_HOME, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 960));
    await page.waitForTimeout(500);
    const buf = await page.screenshot({ type: "png" });
    await saveWebp(buf, join(foundryDir, "british-standard-type.webp"));
  } catch (err) {
    console.warn(`FAIL foundry image: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log("Done.");

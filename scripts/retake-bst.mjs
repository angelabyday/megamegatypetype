// One-off script to retake British Standard Type specimens + foundry image.
// The BST site has a hero section at the top of each page; scroll past it before screenshotting.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
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
  { slug: "spyre",          url: "https://www.britishstandardtype.xyz/typefaces/spyre" },
  { slug: "spyre-epoch",    url: "https://www.britishstandardtype.xyz/typefaces/spyre-epoch" },
  { slug: "bst-bazaine",    url: "https://www.britishstandardtype.xyz/typefaces/bazaine" },
  { slug: "bst-bazaine-mono", url: "https://www.britishstandardtype.xyz/typefaces/bazaine-mono" },
  { slug: "bst-ritma",      url: "https://www.britishstandardtype.xyz/typefaces/ritma" },
  { slug: "bst-symbol-mono", url: "https://www.britishstandardtype.xyz/typefaces/symbol-mono" },
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
    await page.waitForTimeout(1000);
    // Scroll past the hero section (100vh)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(600);
    const buf = await page.screenshot({ type: "png" });
    await saveWebp(buf, join(specimenDir, `${slug}.webp`));
  } catch (err) {
    console.warn(`FAIL ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }
}

// Foundry image
const foundryDir = join(root, "public", "foundry-images");
mkdirSync(foundryDir, { recursive: true });
{
  const page = await ctx.newPage();
  try {
    await page.goto(FOUNDRY_HOME, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(600);
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

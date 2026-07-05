// Retake specimens for Nouvelle Noire "A." series typefaces.
// Screenshots the live .font-editor element (interactive web font preview),
// bumping the font size so letterforms fill the frame.
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
    await page.waitForTimeout(2000);

    // Dismiss cookie banner if present
    const cookieBtn = await page.$("button#CookieLawInfoBar, button.cli-plugin-button, button[aria-label*='cookie' i], button.cli_accept_btn, #cookie-law-info-bar button");
    if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(300); }
    // Also hide any remaining cookie overlay via CSS
    await page.evaluate(() => {
      document.querySelectorAll("#cookie-law-info-bar, .cli-modal-backdrop, #cliSettingsPopup").forEach(el => el.remove());
    });

    // Hide UI chrome within the font editor (cart buttons, weight selector bar)
    await page.evaluate(() => {
      document.querySelectorAll(".font-editor__weight-bar, .font-editor__controls, .woocommerce-variation-add-to-cart, .single_add_to_cart_button, .font-editor__footer, .font-editor__nav").forEach(el => el.remove());
      // Bump font size so letterforms fill the frame
      const textArea = document.querySelector(".font-editor__text-area");
      if (textArea) {
        textArea.style.fontSize = "120px";
        textArea.style.lineHeight = "1.1";
        textArea.style.padding = "24px";
        textArea.style.minHeight = "300px";
        textArea.style.display = "flex";
        textArea.style.alignItems = "center";
        textArea.style.flexWrap = "wrap";
      }
    });
    await page.waitForTimeout(400);

    const el = await page.$(".font-editor__text-area") ?? await page.$(".font-editor");
    if (!el) throw new Error("font-editor not found");
    const buf = await el.screenshot({ type: "png" });
    await saveWebp(buf, join(specimenDir, `${slug}.webp`));
  } catch (err) {
    console.warn(`FAIL ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log("Done.");

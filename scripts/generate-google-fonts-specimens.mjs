// Generates specimen images for Google Fonts by rendering each font in Playwright.
// After completion, updates lib/specimens.json automatically.
//
// Usage:
//   node scripts/generate-google-fonts-specimens.mjs
//   node scripts/generate-google-fonts-specimens.mjs --limit 50
//   node scripts/generate-google-fonts-specimens.mjs --concurrency 8

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECIMENS_DIR = join(root, "public", "specimens");
const FOUNDRY_SLUG = "google-fonts";
const SPECIMEN_WIDTH = 640;
const SPECIMEN_HEIGHT = 400;
const DEFAULT_CONCURRENCY = 6;

function slugify(str) {
  return str
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function specimenPath(slug) {
  return join(SPECIMENS_DIR, FOUNDRY_SLUG, `${slug}.webp`);
}

function buildHtml(family) {
  const encodedFamily = encodeURIComponent(family).replace(/%20/g, "+");
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap`;

  // Escape for HTML attribute/text use
  const safe = family.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${cssUrl}" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 640px; height: 400px; overflow: hidden; background: #f8f7f4; }
  .wrap {
    width: 640px; height: 400px;
    padding: 44px 52px;
    display: flex; flex-direction: column; justify-content: center;
    font-family: '${family}', Georgia, serif;
  }
  .name {
    font-size: 60px; font-weight: 400; line-height: 1.05;
    color: #111; letter-spacing: -0.02em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .alpha {
    font-size: 20px; font-weight: 400; line-height: 1.5;
    color: #444; margin-top: 22px; letter-spacing: 0.03em;
  }
  .nums {
    font-size: 17px; font-weight: 400; line-height: 1.5;
    color: #888; margin-top: 4px; letter-spacing: 0.04em;
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="name">${safe}</div>
  <div class="alpha">Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz</div>
  <div class="nums">0 1 2 3 4 5 6 7 8 9 &amp; ! ? @ # $ % ( ) [ ]</div>
</div>
</body>
</html>`;
}

async function processFont(page, family) {
  const slug = slugify(family);
  const out = specimenPath(slug);
  if (existsSync(out)) return "cached";

  await page.setContent(buildHtml(family), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);

  const buf = await page.screenshot({ type: "png" });
  mkdirSync(join(SPECIMENS_DIR, FOUNDRY_SLUG), { recursive: true });
  await sharp(buf)
    .resize(SPECIMEN_WIDTH, SPECIMEN_HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 75 })
    .toFile(out);

  return "done";
}

async function main() {
  const argv = process.argv.slice(2);
  const limitArg = argv.indexOf("--limit");
  const limit = limitArg >= 0 ? parseInt(argv[limitArg + 1]) : null;
  const concurrencyArg = argv.indexOf("--concurrency");
  const concurrency = concurrencyArg >= 0 ? parseInt(argv[concurrencyArg + 1]) : DEFAULT_CONCURRENCY;

  const fonts = JSON.parse(readFileSync(join(root, "data", "typefaces-google-fonts.json"), "utf8"));
  const all = limit ? fonts.slice(0, limit) : fonts;
  const toProcess = all.filter((f) => !existsSync(specimenPath(slugify(f.name))));
  const alreadyDone = all.length - toProcess.length;

  console.log(`${all.length} fonts — ${alreadyDone} already done, ${toProcess.length} to generate`);
  if (toProcess.length === 0) { console.log("Nothing to do."); return; }

  const browser = await chromium.launch();

  // Create N pages, each with fixed viewport matching specimen dimensions
  const pages = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const p = await browser.newPage();
      await p.setViewportSize({ width: SPECIMEN_WIDTH, height: SPECIMEN_HEIGHT });
      return p;
    })
  );

  let done = 0;
  let errors = 0;
  const total = toProcess.length;

  // Split work evenly across pages
  const chunkSize = Math.ceil(toProcess.length / concurrency);
  const chunks = Array.from({ length: concurrency }, (_, i) =>
    toProcess.slice(i * chunkSize, (i + 1) * chunkSize)
  );

  async function worker(page, chunk) {
    for (const font of chunk) {
      try {
        await processFont(page, font.name);
        done++;
        process.stdout.write(`\r  ${done}/${total}`);
      } catch (err) {
        errors++;
        // silent — continue with next font
      }
    }
  }

  await Promise.all(pages.map((p, i) => worker(p, chunks[i] ?? [])));
  await browser.close();

  process.stdout.write("\n");

  // Update lib/specimens.json
  const specimensPath = join(root, "lib", "specimens.json");
  const specimens = JSON.parse(readFileSync(specimensPath, "utf8"));
  let added = 0;
  for (const font of all) {
    const slug = slugify(font.name);
    const key = `${FOUNDRY_SLUG}/${slug}`;
    if (existsSync(specimenPath(slug)) && !specimens[key]) {
      specimens[key] = true;
      added++;
    }
  }
  if (added > 0) {
    writeFileSync(specimensPath, JSON.stringify(specimens, null, 2) + "\n");
    console.log(`specimens.json updated (+${added} entries)`);
  }

  console.log(`Done. ${done} generated, ${errors} errors.`);
  if (errors > 0) console.log("Re-run to retry errors.");
}

main().catch((err) => { console.error(err); process.exit(1); });

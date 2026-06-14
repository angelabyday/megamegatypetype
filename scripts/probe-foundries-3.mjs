// Third probe batch — new best/okay-tier foundries not yet in index-foundry.mjs
// Usage: node scripts/probe-foundries-3.mjs

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FOUNDRIES = [
  // Best-tier
  { name: "Colophon",            url: "http://www.colophon-foundry.org/typefaces" },
  { name: "CoType Foundry",      url: "https://cotypefoundry.com/fonts" },
  { name: "Family Type",         url: "https://familytype.co/fonts" },
  { name: "Hot Type",            url: "https://hottype.co/fonts" },
  { name: "limitype",            url: "https://limitype.com/fonts" },
  { name: "Luzi Type",           url: "https://www.luzi-type.ch/fonts" },
  { name: "Out of the Dark",     url: "https://www.outofthedark.swiss/typefaces" },
  { name: "Pizza Typefaces",     url: "https://typefaces.pizza/fonts" },
  { name: "Power Type",          url: "https://power-type.com/typefaces" },
  { name: "Source Type",         url: "https://www.sourcetype.com/typefaces/" },
  { name: "That That Type",      url: "https://www.thatthattype.com/typefaces" },
  { name: "Threedotstype",       url: "https://threedotstype.com/typefaces" },
  { name: "Type of Feeling",     url: "https://typeoffeeling.com/typefaces" },
  { name: "Capitalics Warsaw",   url: "https://capitalics.wtf/en/retail-fonts" },
  // Okay-tier
  { name: "ALT.tf",              url: "https://alt-tf.com/typefaces" },
  { name: "Contemporary Type",   url: "https://contemporarytype.com/typefaces" },
  { name: "Double Dagger",       url: "https://www.doubledagger.xyz/typefaces" },
  { name: "Indian Type Foundry", url: "https://www.indiantypefoundry.com/typefaces" },
  { name: "Nouvelle Noire",      url: "https://nouvellenoire.ch/typefaces" },
  { name: "Order",               url: "https://order.design/otf" },
  { name: "Regular Bold Italic", url: "https://regularbolditalic.com/typefaces" },
  { name: "Studio Triple",       url: "https://studiotriple.fr/typefaces" },
];

function scoreLinks(hrefs, pageUrl) {
  const base = new URL(pageUrl);
  const domain = base.hostname;
  const scored = [];
  const seen = new Set();
  for (const href of hrefs) {
    try {
      const u = new URL(href, pageUrl);
      if (u.hostname !== domain) continue;
      if (u.search || u.hash) continue;
      const clean = u.origin + u.pathname.replace(/\/$/, "");
      if (seen.has(clean)) continue;
      seen.add(clean);
      const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts.length < 1 || parts.length > 3) continue;
      scored.push({ url: clean, depth: parts.length, slug: parts[parts.length - 1] });
    } catch {}
  }
  return scored;
}

const NAV_SLUGS = new Set([
  "about", "contact", "news", "blog", "info", "license", "legal", "privacy",
  "terms", "order", "cart", "checkout", "account", "login", "register",
  "search", "404", "faq", "help", "press", "team", "people", "distributors",
  "retailers", "resellers", "trial", "specimen", "index", "collection",
  "custom", "bespoke", "services", "studio", "work", "retail", "journal",
  "type-specimen", "all", "new", "sale", "bundles", "variable", "sans", "serif",
  "slab", "script", "display", "symbol", "monospaced", "inuse", "trials",
  "products", "collections", "category", "tag", "font-category", "shop",
  "en", "fr", "de", "home", "fonts", "typefaces", "cookie", "imprint",
  "sitemap", "newsletter", "language", "licensing", "eula", "otf",
]);

async function probe(browser, foundry) {
  let page;
  try {
    const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
    page = await ctx.newPage();
    await page.goto(foundry.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(400);
    }
    const finalUrl = page.url();
    const hrefs = await page.$$eval("a[href]", els => els.map(e => e.href));
    const scored = scoreLinks(hrefs, finalUrl);
    const candidates = scored.filter(l => !NAV_SLUGS.has(l.slug));
    const depth1 = candidates.filter(l => l.depth === 1);
    const depth2 = candidates.filter(l => l.depth === 2);
    const depth3 = candidates.filter(l => l.depth === 3);
    const best = depth2.length >= depth1.length ? depth2 : depth1.length > 0 ? depth1 : depth3;
    const samples = best.slice(0, 4).map(l => new URL(l.url).pathname);
    const label = foundry.name.padEnd(22);
    if (best.length === 0) {
      console.log(`${label} NONE (landed: ${new URL(finalUrl).pathname})`);
    } else {
      console.log(`${label} ${best.length} | ${samples.join("  ")}`);
    }
    await ctx.close();
  } catch (err) {
    console.log(`${foundry.name.padEnd(22)} ERROR: ${err.message.slice(0, 80)}`);
    if (page) await page.context().close().catch(() => {});
  }
}

const CONCURRENCY = 5;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const queue = [...FOUNDRIES];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const f = queue[cursor++];
      await probe(browser, f);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });

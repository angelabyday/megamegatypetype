// Quick Playwright probe: open each foundry's catalogue page, collect links,
// print how many typeface-shaped URLs exist and 3 samples.
// Usage: node scripts/probe-foundries.mjs

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FOUNDRIES = [
  // Best-tier uncertain — second pass with corrected URLs
  { name: "Arkitype",           url: "https://www.arkitype.co/typefaces" },
  { name: "Colophon",           url: "http://www.colophon-foundry.org/typefaces" },
  { name: "Fable",              url: "https://fable.design/typefaces" },
  { name: "Crescenzi",          url: "https://crescenzi.co/fonts" },
  { name: "Lift Type",          url: "https://www.lift-type.fr/collections" },
  { name: "Ultra Kuhl",         url: "https://ultra-kuhl.com/en/typefaces" },
  // Okay-tier — first pass
  { name: "205TF",              url: "https://www.205.tf/typefaces" },
  { name: "ALT.tf",             url: "https://alt-tf.com/typefaces" },
  { name: "Balto / Type Supply", url: "https://typesupply.com/fonts" },
  { name: "Berzulis",           url: "https://berzulis.com/typefaces" },
  { name: "Big Fog Foundry",    url: "https://foundry.bigfog.co/typefaces" },
  { name: "Bold Monday",        url: "https://www.boldmonday.com/typefaces" },
  { name: "Brandon Nickerson",  url: "https://www.bnicks.com/shop" },
  { name: "Colt Type",          url: "https://wearecolt.com/typefaces" },
  { name: "Commercial Classics",url: "https://commercialclassics.com/catalogue" },
  { name: "Connary Fagen",      url: "https://connary.com/typefaces" },
  { name: "Contemporary Type",  url: "https://contemporarytype.com/typefaces" },
  { name: "Coppers and Brasses",url: "https://coppersandbrasses.com/typefaces" },
  { name: "Darden Studio",      url: "https://www.dardenstudio.com/typefaces" },
  { name: "degarism",           url: "https://degarism.com/typefaces" },
  { name: "Dharma Type",        url: "https://dharmatype.com/typefaces" },
  { name: "Dot Colon",          url: "https://dotcolon.net/fonts" },
  { name: "Double Dagger",      url: "https://www.doubledagger.xyz/typefaces" },
  { name: "East of Rome",       url: "https://eastofrome.com/typefaces" },
  { name: "FOLCH",              url: "https://www.folchstudio.com/typefaces/" },
  { name: "Font Bureau",        url: "https://fontbureau.typenetwork.com/fonts" },
  { name: "Fontfabric",         url: "https://www.fontfabric.com/fonts/" },
  { name: "XYZ Type",           url: "https://xyztype.com/fonts" },
  { name: "Fonts from Folch",   url: "http://fontsfromfolch.com/" },
  { name: "Gradient",           url: "https://wearegradient.net/typefaces" },
  { name: "HvD Fonts",          url: "https://www.hvdfonts.com/fonts" },
  { name: "Indian Type Foundry",url: "https://www.indiantypefoundry.com/typefaces" },
  { name: "Just Another Foundry",url: "https://justanotherfoundry.com/fonts" },
  { name: "Kilotype",           url: "https://kilotype.de/fonts" },
  { name: "KOMETA Typefaces",   url: "https://www.kometa.xyz/typefaces/" },
  { name: "Kurppa Hosk Type",   url: "https://khtype.com/fonts" },
  { name: "Latinotype",         url: "http://latinotype.com/typefaces" },
  { name: "Letterjuice",        url: "http://letterjuice.cat/fonts" },
  { name: "Lettermin",          url: "https://lettermin.com/typefaces" },
  { name: "Letters from Sweden",url: "https://lettersfromsweden.se/typefaces" },
  { name: "Lewis McGuffie",     url: "https://www.lewismcguffie.com/typefaces" },
  { name: "lo-ol Type",         url: "https://www.lo-ol.design/fonts" },
  { name: "Milieu Grotesque",   url: "http://www.milieugrotesque.com/typefaces" },
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
  "en", "fr", "de", "home",
]);

async function probe(browser, foundry) {
  let page;
  try {
    const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
    page = await ctx.newPage();
    await page.goto(foundry.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    // light scroll
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(500);
    }
    const hrefs = await page.$$eval("a[href]", els => els.map(e => e.href));
    const scored = scoreLinks(hrefs, page.url());
    const candidates = scored.filter(l => !NAV_SLUGS.has(l.slug));
    const depth1 = candidates.filter(l => l.depth === 1);
    const depth2 = candidates.filter(l => l.depth === 2);
    const depth3 = candidates.filter(l => l.depth === 3);
    const best = depth2.length >= depth1.length ? depth2 : depth1.length > 0 ? depth1 : depth3;
    const samples = best.slice(0, 3).map(l => new URL(l.url).pathname);
    const label = foundry.name.padEnd(24);
    if (best.length === 0) {
      console.log(`${label} NONE`);
    } else {
      console.log(`${label} ${best.length} | ${samples.join(" ")}`);
    }
    await ctx.close();
  } catch (err) {
    console.log(`${foundry.name.padEnd(24)} ERROR: ${err.message.slice(0, 60)}`);
    if (page) await page.context().close().catch(() => {});
  }
}

const CONCURRENCY = 6;

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

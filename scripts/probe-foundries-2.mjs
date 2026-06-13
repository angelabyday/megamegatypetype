// Second probe batch — unprobed okay/best tier foundries
// Usage: node scripts/probe-foundries-2.mjs

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FOUNDRIES = [
  { name: "Bold Monday",          url: "https://www.boldmonday.com/typefaces" },
  { name: "Indian Type Foundry",  url: "https://www.indiantypefoundry.com/typefaces" },
  { name: "Milieu Grotesque",     url: "http://www.milieugrotesque.com/typefaces" },
  { name: "Narrow Type",          url: "https://www.narrowtype.com/typefaces" },
  { name: "Nouvelle Noire",       url: "https://nouvellenoire.ch/typefaces" },
  { name: "Superior Type",        url: "https://www.superiortype.com/typefaces" },
  { name: "TypeMates",            url: "https://www.typemates.com/typefaces" },
  { name: "TypeTogether",         url: "https://www.type-together.com/fonts" },
  { name: "Suitcase Type",        url: "https://www.suitcasetype.com/fonts" },
  { name: "SilverStag",           url: "https://silverstagtype.com/fonts" },
  { name: "Lettermatic",          url: "https://lettermatic.com/fonts" },
  { name: "R-Typography",         url: "https://www.r-typography.com/typefaces" },
  { name: "Radim Pesko",          url: "https://radimpesko.com/fonts" },
  { name: "Regular Bold Italic",  url: "https://regularbolditalic.com/typefaces" },
  { name: "TypeFriends",          url: "https://typefriends.com/typefaces" },
  { name: "Studio Triple",        url: "https://studiotriple.fr/typefaces" },
  { name: "ORDER",                url: "https://order.design/typefaces" },
  { name: "TYPE01",               url: "https://type-01.com/typefaces" },
  { name: "The Foundry Types",    url: "https://www.thefoundrytypes.com/fonts" },
  { name: "Tokotype",             url: "https://www.tokotype.com/typefaces" },
  { name: "Type Department",      url: "https://type-department.com/typefaces" },
  { name: "Type Forward",         url: "https://www.typeforward.com/typefaces" },
  { name: "TypeType",             url: "https://typetype.org/fonts" },
  { name: "Death of Typography",  url: "https://deathoftypography.com/typefaces" },
  { name: "Mojomox",              url: "https://fonts.mojomox.com/fonts" },
  { name: "Monkey Type",          url: "https://monkeytype.xyz/fonts" },
  { name: "Nikolas Type",         url: "https://www.nikolastype.com/typefaces" },
  { name: "ECAL Typefaces",       url: "https://ecal-typefaces.ch/typefaces" },
  { name: "zetafonts",            url: "https://www.zetafonts.com/fonts" },
  { name: "type.today",           url: "https://type.today/en/fonts" },
  { name: "Village",              url: "https://vllg.com/fonts" },
  { name: "WELTKERN",             url: "https://www.weltkern.com/typeface" },
  { name: "Uxum",                 url: "https://www.uxumuxum.com/typefaces" },
  { name: "HvD Fonts",            url: "https://www.hvdfonts.com/fonts" },
  { name: "Connary Fagen",        url: "https://connary.com/fonts" },
  { name: "Milieu Grotesque",     url: "http://www.milieugrotesque.com/typefaces" },
  { name: "Pizza Typefaces",      url: "https://typefaces.pizza/fonts" },
  { name: "Type of Feeling",      url: "https://typeoffeeling.com/typefaces" },
  { name: "Dirty Line Studio",    url: "https://dirtylinestudio.com/product-category/fonts" },
  { name: "205TF",                url: "https://www.205.tf/typefaces" },
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
  "sitemap", "newsletter", "language", "licensing", "eula",
]);

async function probe(browser, foundry) {
  let page;
  try {
    const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
    page = await ctx.newPage();
    await page.goto(foundry.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
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

// Quick Playwright probe: open each foundry's catalogue page, collect links,
// print how many typeface-shaped URLs exist and 3 samples.
// Usage: node scripts/probe-foundries.mjs

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FOUNDRIES = [
  { name: "Aeonik",             url: "https://aeonik.co.uk/font/" },
  { name: "Almarena",           url: "https://almarenafoundry.com/" },
  { name: "Arkitype",           url: "https://www.arkitype.co/typefaces" },
  { name: "Binnenland",         url: "https://www.binnenland.ch/" },
  { name: "Catalogue (Florian Karsten)", url: "https://fonts.floriankarsten.com/catalogue" },
  { name: "Colophon",           url: "http://www.colophon-foundry.org/typefaces" },
  { name: "CoType",             url: "https://cotypefoundry.com/typefaces" },
  { name: "Dutype",             url: "https://dutypefoundry.com/fonts" },
  { name: "Fable",              url: "https://fable.design/typefaces" },
  { name: "Family Type",        url: "https://familytype.co/fonts" },
  { name: "Crescenzi",          url: "https://crescenzi.co/fonts" },
  { name: "Dirty Line Studio",  url: "https://dirtylinestudio.com/product-category/fonts/" },
  { name: "Leinster Type",      url: "https://www.leinstertype.com/fonts" },
  { name: "Frost",              url: "https://frostype.xyz/typefaces" },
  { name: "General Type Studio",url: "https://www.generaltypestudio.com/fonts" },
  { name: "Groteskly Yours",    url: "https://groteskly.xyz/typefaces" },
  { name: "Taylor Penton",      url: "https://www.taylorpenton.com/fonts" },
  { name: "A2-Type",            url: "https://a2-type.co.uk/fonts" },
  { name: "Hot Type",           url: "https://hottype.co/typefaces" },
  { name: "Ian Adjeidu / Studio Plums", url: "https://studioplums.com/typefaces" },
  { name: "Lettersetal",        url: "https://experim-ental.lettersetal.co.uk/" },
  { name: "Lift Type",          url: "https://www.lift-type.fr/typefaces" },
  { name: "Limitype",           url: "https://limitype.com/typefaces" },
  { name: "Luzi Type",          url: "https://www.luzi-type.ch/typefaces" },
  { name: "McLetters",          url: "https://mcletters.co/typefaces" },
  { name: "Out of the Dark",    url: "https://www.outofthedark.swiss/typefaces" },
  { name: "Pizza Typefaces",    url: "https://typefaces.pizza/typefaces" },
  { name: "Playtype",           url: "https://playtype.com/typefaces" },
  { name: "Power Type",         url: "https://power-type.com/typefaces" },
  { name: "Prioritype",         url: "https://prioritypeco.com/typefaces" },
  { name: "Capitalics",         url: "https://capitalics.wtf/en/retail-fonts" },
  { name: "Source Type",        url: "https://www.sourcetype.com/typefaces/" },
  { name: "Souvenir Typefaces", url: "https://souvenirtypefaces.xyz/typefaces" },
  { name: "Rene Bieder",        url: "https://www.renebieder.com/fonts" },
  { name: "That That Type",     url: "https://www.thatthattype.com/typefaces" },
  { name: "Designers Foundry",  url: "https://thedesignersfoundry.com/typefaces" },
  { name: "Northern Block",     url: "http://www.thenorthernblock.co.uk/fonts" },
  { name: "Threedotstype",      url: "https://threedotstype.com/fonts/" },
  { name: "TIGHTYPE",           url: "https://tightype.com/typefaces" },
  { name: "Type of Feeling",    url: "https://typeoffeeling.com/typefaces" },
  { name: "Typeverything",      url: "https://typeverything.com/typefaces" },
  { name: "Typokompanii",       url: "https://www.typokompanii.com/typefaces" },
  { name: "VJ Type",            url: "https://vj-type.com/typefaces" },
  { name: "Ultra Kuhl",         url: "https://ultra-kuhl.com/en/collections" },
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

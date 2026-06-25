// Crawl typeface pages from new foundries and generate data/typefaces-[slug].json via Claude.
//
// Usage:
//   node scripts/index-foundry.mjs                    # all 5 foundries
//   node scripts/index-foundry.mjs --foundry lineto   # one foundry
//   node scripts/index-foundry.mjs --dry-run          # list URLs, no Claude calls
//   INDEX_MODEL=claude-opus-4-8 node scripts/index-foundry.mjs
//
// ANTHROPIC_API_KEY is auto-loaded from .env.local if not already in env.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECIMENS_DIR = join(root, "public", "specimens");
const MANIFEST_PATH = join(root, "lib", "specimens.json");
const SPECIMEN_WIDTH = 640;
const SPECIMEN_HEIGHT = 400;
const UA_IMG =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// Load .env.local so ANTHROPIC_API_KEY works when running standalone
try {
  const envFile = join(root, ".env.local");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const eq = line.indexOf("=");
      if (eq < 1 || line.trimStart().startsWith("#")) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const MODEL = process.env.INDEX_MODEL ?? "claude-sonnet-4-6";
const PAGE_DELAY_MS = 500;
const FOUNDRY_DELAY_MS = 3000;
const CONCURRENCY = 3;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const COOKIE_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  '[class*="cookie"] button[class*="accept"]',
  '[id*="cookie"] button[class*="accept"]',
  'button[aria-label*="ccept"]',
  ".cc-allow",
  ".cky-btn-accept",
];

// Path slugs that appear inside typeface listing paths but are not individual typeface pages
const NON_TYPEFACE_SLUGS = new Set([
  "about", "contact", "news", "blog", "info", "license", "legal", "privacy",
  "terms", "order", "cart", "checkout", "account", "login", "register",
  "search", "404", "faq", "help", "press", "team", "people", "distributors",
  "retailers", "resellers", "trial", "specimen", "index", "collection",
  "custom", "bespoke", "services", "studio", "work", "retail", "journal",
  "type-specimen", "all", "new", "sale", "bundles", "variable",
  // Typotheque category filter pages:
  "sans", "serif", "slab", "script", "display", "symbol", "monospaced",
  // Camelot navigation:
  "inuse", "trials",
]);

// ---- Foundry config ----
// listingUrl: page that lists all typefaces (may be JS-rendered)
// filterFn: optional custom URL filter; default is makeTypefaceFilter(listingUrl)
// scrollCount: scroll iterations on the listing page (default 20); increase for lazy-loading catalogs
const FOUNDRIES = [
  {
    name: "Lineto",
    slug: "lineto",
    homepage: "https://lineto.com/",
    listingUrl: "https://lineto.com/typefaces/",
    tier: "best",
    // default filter handles this; query-string stripping removes ?set= script variants
  },
  {
    name: "Swiss Typefaces",
    slug: "swiss-typefaces",
    homepage: "https://www.swisstypefaces.com/",
    listingUrl: "https://www.swisstypefaces.com/fonts/",
    tier: "best",
  },
  {
    name: "Production Type",
    slug: "production-type",
    homepage: "https://www.productiontype.com/",
    listingUrl: "https://www.productiontype.com/fonts",
    tier: "best",
    scrollCount: 60,
    // typeface pages live at /font/[slug], not /fonts/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        // site uses both productiontype.com and www.productiontype.com
        if (!u.hostname.endsWith("productiontype.com")) return false;
        if (u.search) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font";
      } catch { return false; }
    },
  },
  {
    name: "Newlyn",
    slug: "newlyn",
    homepage: "https://newlyn.com/",
    listingUrl: "https://newlyn.com/fonts",
    tier: "best",
  },
  {
    name: "Typotheque",
    slug: "typotheque",
    homepage: "https://www.typotheque.com/",
    listingUrl: "https://www.typotheque.com/fonts/",
    tier: "best",
  },
  {
    name: "OH no Type",
    slug: "oh-no-type",
    homepage: "https://ohnotype.co/",
    listingUrl: "https://ohnotype.co/fonts",
    tier: "best",
  },
  {
    name: "Fontwerk",
    slug: "fontwerk",
    homepage: "https://fontwerk.com/",
    listingUrl: "https://fontwerk.com/en/fonts",
    tier: "best",
  },
  {
    name: "CAST",
    slug: "cast",
    homepage: "https://www.c-a-s-t.com/",
    listingUrl: "https://www.c-a-s-t.com/typefaces",
    tier: "best",
    scrollCount: 40,
  },
  {
    name: "Camelot",
    slug: "camelot",
    homepage: "https://camelot-typefaces.com/",
    listingUrl: "https://camelot-typefaces.com/",
    tier: "best",
    // typeface pages are at root-level paths (depth 1), not under a /typefaces/ prefix
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("camelot-typefaces.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        return !NON_TYPEFACE_SLUGS.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Extraset",
    slug: "extraset",
    homepage: "https://extraset.ch/",
    listingUrl: "https://extraset.ch/typefaces",
    tier: "best",
  },
  {
    name: "Fatype",
    slug: "fatype",
    homepage: "https://fatype.com/",
    listingUrl: "https://fatype.com/typefaces",
    tier: "best",
  },
  {
    name: "NaN",
    slug: "nan",
    homepage: "https://www.nan.xyz/",
    listingUrl: "https://www.nan.xyz/fonts/",
    tier: "best",
    scrollCount: 35,
  },
  {
    name: "Sociotype",
    slug: "sociotype",
    homepage: "https://socio-type.com/",
    listingUrl: "https://socio-type.com/",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("socio-type.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        return !NON_TYPEFACE_SLUGS.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Signal",
    slug: "signal",
    homepage: "https://signalfoundry.com/",
    listingUrl: "https://signalfoundry.com/typefaces",
    tier: "best",
  },
  {
    name: "Blaze Type",
    slug: "blaze-type",
    homepage: "https://blazetype.eu/",
    listingUrl: "https://blazetype.eu/typefaces",
    tier: "best",
  },
  {
    name: "a.Foundry",
    slug: "a-foundry",
    homepage: "https://a-foundry.com/",
    listingUrl: "https://a-foundry.com/fonts/",
    tier: "best",
  },
  {
    name: "AllCaps",
    slug: "allcaps",
    homepage: "https://www.allcapstype.com/",
    listingUrl: "https://www.allcapstype.com/typefaces",
    tier: "best",
  },
  {
    name: "Arillatype",
    slug: "arillatype",
    homepage: "https://arillatype.studio/",
    listingUrl: "https://arillatype.studio/fonts",
    tier: "best",
    // listing at /fonts but individual typefaces live at /font/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "arillatype.studio") return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Faire Type",
    slug: "faire-type",
    homepage: "https://www.fairetype.com/",
    listingUrl: "https://www.fairetype.com/fonts",
    tier: "best",
    // Shopify store: typefaces at /collections/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("fairetype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "collections" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "British Standard Type",
    slug: "british-standard-type",
    homepage: "https://www.britishstandardtype.xyz/",
    listingUrl: "https://www.britishstandardtype.xyz/typefaces",
    tier: "best",
  },
  {
    name: "OTT Foundry",
    slug: "ott-foundry",
    homepage: "https://ott-foundry.com/",
    listingUrl: "https://ott-foundry.com/typefaces",
    tier: "best",
    scrollCount: 30,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("ott-foundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Bureau Brut",
    slug: "bureau-brut",
    homepage: "https://bureaubrut.com/",
    listingUrl: "https://bureaubrut.com/en/",
    tier: "best",
    // typefaces at /family/[slug]; other depth-2 paths (e.g. /users/log-in) excluded
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("bureaubrut.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "family";
      } catch { return false; }
    },
  },
  {
    name: "A Type of Amigo",
    slug: "a-type-of-amigo",
    homepage: "https://atypeofamigo.com/",
    listingUrl: "https://atypeofamigo.com/fonts/",
    tier: "best",
    // exclude /font-category/[slug] paths; only /fonts/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("atypeofamigo.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Bastarda",
    slug: "bastarda",
    homepage: "https://bastardatype.com/",
    listingUrl: "https://bastardatype.com/fonts/",
    tier: "best",
    // listing at /fonts/ but individual typefaces at /font/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("bastardatype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Interval Type",
    slug: "interval-type",
    homepage: "https://intervaltype.com/",
    listingUrl: "https://intervaltype.com/fonts/",
    tier: "best",
    // Shopify-style: typefaces at /product/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("intervaltype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "product" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Due Studio",
    slug: "due-studio",
    homepage: "https://www.due-studio.com/",
    listingUrl: "https://www.due-studio.com/typefaces",
    tier: "best",
  },
  {
    name: "Typespec",
    slug: "typespec",
    homepage: "https://typespec.co.uk/",
    listingUrl: "https://typespec.co.uk/shop/",
    tier: "best",
    staticUrls: [
      "https://typespec.co.uk/downloads/atype-stencil/",
      "https://typespec.co.uk/downloads/blakey-slab/",
      "https://typespec.co.uk/downloads/bword/",
      "https://typespec.co.uk/downloads/doves-type-headline/",
      "https://typespec.co.uk/downloads/grace-roman/",
      "https://typespec.co.uk/downloads/mfred-rounded/",
      "https://typespec.co.uk/downloads/nsw-01/",
      "https://typespec.co.uk/downloads/organon/",
      "https://typespec.co.uk/downloads/timmons-ny/",
      "https://typespec.co.uk/downloads/doves-type-imprint/",
      "https://typespec.co.uk/downloads/heseltine/",
      "https://typespec.co.uk/downloads/laura/",
      "https://typespec.co.uk/downloads/mfred/",
    ],
  },

  // ---- Batch 4 ----
  {
    name: "Almarena",
    slug: "almarena",
    homepage: "https://almarenafoundry.com/",
    listingUrl: "https://almarenafoundry.com/",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("almarenafoundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "collection" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "A2-Type",
    slug: "a2-type",
    homepage: "https://a2-type.co.uk/",
    listingUrl: "https://a2-type.co.uk/fonts",
    tier: "best",
    scrollCount: 30,
    // typefaces at root-level paths (/a2-gothic etc.) — same pattern as Camelot
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("a2-type.co.uk")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["fonts", "about", "terms-conditions", "privacy-policy", "cookies",
          "distributors", "in-use", "news", "contact", "licensing", "trial"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Binnenland",
    slug: "binnenland",
    homepage: "https://www.binnenland.ch/",
    listingUrl: "https://www.binnenland.ch/",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("binnenland.ch")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Catalogue (Florian Karsten)",
    slug: "catalogue",
    homepage: "https://fonts.floriankarsten.com/",
    listingUrl: "https://fonts.floriankarsten.com/catalogue",
    tier: "best",
    // typefaces at root-level paths (/fk-grotesk etc.)
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("floriankarsten.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["catalogue", "eula", "about", "contact", "impressum"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Frost",
    slug: "frost",
    homepage: "https://frostype.xyz/",
    listingUrl: "https://frostype.xyz/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("frostype.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Groteskly Yours",
    slug: "groteskly-yours",
    homepage: "https://groteskly.xyz/",
    listingUrl: "https://groteskly.xyz/fonts",
    tier: "best",
  },
  {
    name: "General Type Studio",
    slug: "general-type-studio",
    homepage: "https://www.generaltypestudio.com/",
    listingUrl: "https://www.generaltypestudio.com/fonts",
    tier: "best",
  },
  {
    name: "Leinster Type",
    slug: "leinster-type",
    homepage: "https://www.leinstertype.com/",
    listingUrl: "https://www.leinstertype.com/fonts",
    tier: "best",
  },
  {
    name: "Playtype",
    slug: "playtype",
    homepage: "https://playtype.com/",
    listingUrl: "https://playtype.com/typefaces",
    tier: "best",
    scrollCount: 30,
  },
  {
    name: "Studio Rene Bieder",
    slug: "studio-rene-bieder",
    homepage: "https://www.renebieder.com/",
    listingUrl: "https://www.renebieder.com/fonts",
    tier: "best",
  },
  {
    name: "The Designers Foundry",
    slug: "the-designers-foundry",
    homepage: "https://thedesignersfoundry.com/",
    listingUrl: "https://thedesignersfoundry.com/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("thedesignersfoundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Prioritype",
    slug: "prioritype",
    homepage: "https://prioritypeco.com/",
    listingUrl: "https://prioritypeco.com/product-category/font",
    tier: "best",
    // Shopify-style: typefaces at /product/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("prioritypeco.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "product" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Taylor Penton",
    slug: "taylor-penton",
    homepage: "https://www.taylorpenton.com/",
    listingUrl: "https://www.taylorpenton.com/fonts",
    tier: "best",
    // Shopify: typefaces at /products/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("taylorpenton.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "VJ Type",
    slug: "vj-type",
    homepage: "https://vj-type.com/",
    listingUrl: "https://vj-type.com/collections",
    tier: "best",
    // Shopify: typefaces at /collections/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("vj-type.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "collections" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 5 ----
  {
    name: "Balto / Type Supply",
    slug: "balto-type-supply",
    homepage: "https://typesupply.com/",
    listingUrl: "https://typesupply.com/fonts",
    tier: "okay",
  },
  {
    name: "Big Fog Foundry",
    slug: "big-fog-foundry",
    homepage: "https://foundry.bigfog.co/",
    listingUrl: "https://foundry.bigfog.co/typefaces",
    tier: "okay",
  },
  {
    name: "Coppers and Brasses",
    slug: "coppers-and-brasses",
    homepage: "https://coppersandbrasses.com/",
    listingUrl: "https://coppersandbrasses.com/typefaces",
    tier: "okay",
    // exclude /accounts/... nav links
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("coppersandbrasses.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Darden Studio",
    slug: "darden-studio",
    homepage: "https://www.dardenstudio.com/",
    listingUrl: "https://www.dardenstudio.com/typefaces",
    tier: "okay",
    // typefaces at root-level paths (/omnes, /gamay etc.)
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("dardenstudio.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["typefaces", "catalog", "about", "contact", "news", "work", "services"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Colt Type",
    slug: "colt-type",
    homepage: "https://wearecolt.com/",
    listingUrl: "https://wearecolt.com/typefaces",
    tier: "okay",
    // Shopify: typefaces at /product/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("wearecolt.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "product" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Dharma Type",
    slug: "dharma-type",
    homepage: "https://dharmatype.com/",
    listingUrl: "https://dharmatype.com/",
    tier: "okay",
    scrollCount: 40,
    // typefaces at root-level paths; exclude nav slugs and section pages
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("dharmatype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["typefaces", "fonts", "about", "contact", "blog", "shop",
          "cart", "checkout", "licensing", "distributors", "press"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "XYZ Type",
    slug: "xyz-type",
    homepage: "https://xyztype.com/",
    listingUrl: "https://xyztype.com/fonts",
    tier: "okay",
  },
  {
    name: "Kilotype",
    slug: "kilotype",
    homepage: "https://kilotype.de/",
    listingUrl: "https://kilotype.de/fonts",
    tier: "okay",
    // typefaces at /families/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("kilotype.de")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "families" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "KOMETA Typefaces",
    slug: "kometa-typefaces",
    homepage: "https://www.kometa.xyz/",
    listingUrl: "https://www.kometa.xyz/typefaces/",
    tier: "okay",
    // redirects to kometatype.com — can't use strict hostname filter
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("kometatype.com") && !u.hostname.includes("kometa.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Kurppa Hosk Type",
    slug: "kurppa-hosk-type",
    homepage: "https://khtype.com/",
    listingUrl: "https://khtype.com/fonts",
    tier: "okay",
    // typefaces at /typeface/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("khtype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Gradient",
    slug: "gradient",
    homepage: "https://wearegradient.net/",
    listingUrl: "https://wearegradient.net/typefaces",
    tier: "okay",
  },
  {
    name: "Letters from Sweden",
    slug: "letters-from-sweden",
    homepage: "https://lettersfromsweden.se/",
    listingUrl: "https://lettersfromsweden.se/typefaces",
    tier: "okay",
    // typefaces at /font/[slug], not /typefaces/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("lettersfromsweden.se")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 6 ----
  {
    name: "East of Rome",
    slug: "east-of-rome",
    homepage: "https://eastofrome.com/",
    listingUrl: "https://eastofrome.com/typefaces",
    tier: "okay",
    // typefaces at /fonts/[slug], not /typefaces/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("eastofrome.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Commercial Classics",
    slug: "commercial-classics",
    homepage: "https://showcase.commercialclassics.com/",
    listingUrl: "https://showcase.commercialclassics.com/",
    tier: "okay",
    scrollCount: 30,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("commercialclassics.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        return !NON_TYPEFACE_SLUGS.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "HvD Fonts",
    slug: "hvd-fonts",
    homepage: "https://www.hvdfonts.com/",
    listingUrl: "https://www.hvdfonts.com/fonts",
    tier: "okay",
    specimenMinY: 1500,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("hvdfonts.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "fonts") return false;
        const CATS = new Set(["text", "free", "new", "variable", "bestseller", "all"]);
        return !NON_TYPEFACE_SLUGS.has(parts[1]) && !CATS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Connary Fagen",
    slug: "connary-fagen",
    homepage: "https://connary.com/",
    listingUrl: "https://connary.com/fonts",
    tier: "okay",
  },
  {
    name: "Narrow Type",
    slug: "narrow-type",
    homepage: "https://www.narrowtype.com/",
    listingUrl: "https://www.narrowtype.com/typefaces",
    tier: "okay",
    // listing at /typefaces but individual typefaces live at /fonts/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("narrowtype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "TypeTogether",
    slug: "type-together",
    homepage: "https://www.type-together.com/",
    listingUrl: "https://www.type-together.com/font-catalogue",
    tier: "okay",
    scrollCount: 30,
    // typefaces at /[slug]-font or /[slug]; exclude nav and category pages
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("type-together.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const slug = parts[0];
        const NAV = new Set([
          "font-catalogue", "fonts", "typefaces", "type-designers", "about", "contact",
          "blog", "custom-type", "news", "education", "resellers", "licensing", "faq",
          "ebooks", "corporate", "services", "awards", "in-use", "recent", "privacy-policy",
          "cookie-policy", "terms-conditions", "newsletter-archive", "subscribe-to-newsletter",
          "careers", "press-resources", "payment-form", "customtypes", "catalogue",
          "merchandising", "my-account", "profile", "order-history", "my-downloads", "logout",
          "wishlist", "checkout", "cart", "register", "sign-in",
        ]);
        // Category pages end in -fonts (e.g. display-fonts, book-fonts)
        if (slug.endsWith("-fonts") || slug.endsWith("-font-collection")) return false;
        return !NON_TYPEFACE_SLUGS.has(slug) && !NAV.has(slug);
      } catch { return false; }
    },
  },
  {
    name: "Suitcase Type Foundry",
    slug: "suitcase-type",
    homepage: "https://www.suitcasetype.com/",
    listingUrl: "https://www.suitcasetype.com/fonts",
    tier: "okay",
  },
  {
    name: "Lettermatic",
    slug: "lettermatic",
    homepage: "https://lettermatic.com/",
    listingUrl: "https://lettermatic.com/fonts",
    tier: "okay",
  },
  {
    name: "Radim Pesko",
    slug: "radim-pesko",
    homepage: "https://radimpesko.com/",
    listingUrl: "https://radimpesko.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("radimpesko.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "The Foundry Types",
    slug: "the-foundry-types",
    homepage: "https://www.thefoundrytypes.com/",
    listingUrl: "https://www.thefoundrytypes.com/fonts",
    tier: "okay",
  },
  {
    name: "Type Forward",
    slug: "type-forward",
    homepage: "https://www.typeforward.com/",
    listingUrl: "https://www.typeforward.com/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typeforward.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Nikolas Type",
    slug: "nikolas-type",
    homepage: "https://www.nikolastype.com/",
    listingUrl: "https://www.nikolastype.com/typefaces",
    tier: "okay",
    // listing at /typefaces; individual typefaces at /fonts/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("nikolastype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Death of Typography",
    slug: "death-of-typography",
    homepage: "https://deathoftypography.com/",
    listingUrl: "https://deathoftypography.com/typefaces",
    tier: "okay",
    // typefaces at root-level /[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("deathoftypography.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["typefaces", "about", "contact", "workshops", "news", "services"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Monkey Type",
    slug: "monkey-type",
    homepage: "https://monkeytype.xyz/",
    listingUrl: "https://monkeytype.xyz/fonts",
    tier: "okay",
    // small foundry; typefaces at root-level /[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("monkeytype.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["fonts", "about", "contact", "portfolio"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "TypeType",
    slug: "type-type",
    homepage: "https://typetype.org/",
    listingUrl: "https://typetype.org/fonts",
    tier: "okay",
    scrollCount: 40,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typetype.org")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "fonts") return false;
        // All TypeType fonts are prefixed tt-; everything else is a category/filter page
        return parts[1].startsWith("tt-");
      } catch { return false; }
    },
  },
  {
    name: "ECAL Typefaces",
    slug: "ecal-typefaces",
    homepage: "https://ecal-typefaces.ch/",
    listingUrl: "https://ecal-typefaces.ch/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("ecal-typefaces.ch")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "WELTKERN",
    slug: "weltkern",
    homepage: "https://www.weltkern.com/",
    listingUrl: "https://www.weltkern.com/typeface",
    tier: "okay",
    // listing at /typeface (singular); individual pages at /typefaces/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("weltkern.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Village",
    slug: "village",
    homepage: "https://vllg.com/",
    listingUrl: "https://vllg.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("vllg.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Dirty Line Studio",
    slug: "dirty-line-studio",
    homepage: "https://dirtylinestudio.com/",
    listingUrl: "https://dirtylinestudio.com/product-category/fonts",
    tier: "okay",
    // WooCommerce: typefaces at /product/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("dirtylinestudio.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "product" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Mojomox",
    slug: "mojomox",
    homepage: "https://fonts.mojomox.com/",
    listingUrl: "https://fonts.mojomox.com/en-gb/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("mojomox.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "205TF",
    slug: "205tf",
    homepage: "https://www.205.tf/",
    listingUrl: "https://www.205.tf/typefaces",
    tier: "okay",
    // typefaces at /typefaces/[slug] depth-2
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("205.tf")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Fable",
    slug: "fable",
    homepage: "https://fable.design/",
    listingUrl: "https://fable.design/typefaces",
    tier: "best",
    // typefaces at root-level /[slug]; /typefaces /About are nav
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("fable.design")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const slug = parts[0].toLowerCase();
        const NAV = new Set(["typefaces", "about", "contact", "studio", "work", "news", "design",
          "licence", "license", "type-pack", "bundles", "newsletter"]);
        return !NON_TYPEFACE_SLUGS.has(slug) && !NAV.has(slug);
      } catch { return false; }
    },
  },
  {
    name: "Arkitype",
    slug: "arkitype",
    homepage: "https://www.arkitype.co/",
    listingUrl: "https://www.arkitype.co/typefaces",
    tier: "best",
    // typefaces at root-level /[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("arkitype.co")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set([
          "typefaces", "fonts-in-use", "about", "contact", "news",
          "custom-type", "licensing", "legal", "privacy", "cookies",
        ]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Crescenzi",
    slug: "crescenzi",
    homepage: "https://crescenzi.co/",
    listingUrl: "https://crescenzi.co/fonts",
    tier: "best",
    // small foundry; typefaces at root-level /[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("crescenzi.co")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["fonts", "about", "contact", "info", "work", "faq", "services"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Lift Type",
    slug: "lift-type",
    homepage: "https://www.lift-type.fr/",
    listingUrl: "https://www.lift-type.fr/collections/all",
    tier: "best",
    // Shopify: typefaces at /products/[slug]; exclude license purchases and weight variants
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("lift-type.fr")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 2 || parts[0] !== "products") return false;
        const slug = parts[1];
        if (slug.includes("license") || slug.includes("pack")) return false;
        if (/-(bold|medium|regular|light|thin|black|heavy|italic|oblique|condensed|expanded|extended|narrow|wide|ultra|semi|extra)$/.test(slug)) return false;
        return !NON_TYPEFACE_SLUGS.has(slug);
      } catch { return false; }
    },
  },
  {
    name: "Ultra Kuhl",
    slug: "ultra-kuhl",
    homepage: "https://ultra-kuhl.com/",
    listingUrl: "https://ultra-kuhl.com/en/typefaces",
    tier: "best",
    // URLs are /en/typefaces/[slug] (depth 3)
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("ultra-kuhl.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return (
          parts.length === 3 &&
          parts[0] === "en" &&
          parts[1] === "typefaces" &&
          !NON_TYPEFACE_SLUGS.has(parts[2])
        );
      } catch { return false; }
    },
  },
  {
    name: "Bold Monday",
    slug: "bold-monday",
    homepage: "https://www.boldmonday.com/",
    listingUrl: "https://www.boldmonday.com/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("boldmonday.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Letterjuice",
    slug: "letterjuice",
    homepage: "http://letterjuice.cat/",
    listingUrl: "http://letterjuice.cat/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("letterjuice.cat")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "SilverStag Type",
    slug: "silverstag-type",
    homepage: "https://silverstagtype.com/",
    listingUrl: "https://silverstagtype.com/collections/all",
    tier: "okay",
    // Shopify: typefaces at /products/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("silverstagtype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Milieu Grotesque",
    slug: "milieu-grotesque",
    homepage: "http://www.milieugrotesque.com/",
    listingUrl: "http://www.milieugrotesque.com/typefaces",
    tier: "okay",
  },

  // ---- Batch 7 ----
  {
    name: "Hot Type",
    slug: "hot-type",
    homepage: "https://hottype.co/",
    listingUrl: "https://hottype.co/fonts",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("hottype.co")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Order",
    slug: "order",
    homepage: "https://order.design/",
    listingUrl: "https://order.design/otf",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("order.design")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "otf" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Luzi Type",
    slug: "luzi-type",
    homepage: "https://www.luzi-type.ch/",
    listingUrl: "https://www.luzi-type.ch/fonts",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("luzi-type.ch")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set([
          "fonts", "about", "contact", "support", "notes", "test-fonts",
          "news", "imprint", "terms", "privacy", "legal", "custom",
          "services", "licensing", "team", "studio", "shop", "cart",
        ]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Double Dagger",
    slug: "double-dagger",
    homepage: "https://www.doubledagger.xyz/",
    listingUrl: "https://www.doubledagger.xyz/type",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("doubledagger.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 3 && parts[0] === "type" && parts[1] === "p" && !NON_TYPEFACE_SLUGS.has(parts[2]);
      } catch { return false; }
    },
  },
  {
    name: "Indian Type Foundry",
    slug: "indian-type-foundry",
    homepage: "https://www.indiantypefoundry.com/",
    listingUrl: "https://www.indiantypefoundry.com/fonts",
    tier: "okay",
    staticUrls: [
      "https://www.indiantypefoundry.com/fonts/associate-mono",
      "https://www.indiantypefoundry.com/fonts/griff",
      "https://www.indiantypefoundry.com/fonts/associate-sans-stencil",
    ],
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("indiantypefoundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Tightype",
    slug: "tightype",
    homepage: "https://tightype.com/",
    listingUrl: "https://tightype.com/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("tightype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Pizza Typefaces",
    slug: "pizza-typefaces",
    homepage: "https://typefaces.pizza/",
    listingUrl: "https://typefaces.pizza/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typefaces.pizza")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "type" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "That That Type",
    slug: "that-that-type",
    homepage: "https://thatthattype.com/",
    listingUrl: "https://thatthattype.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("thatthattype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Fontfabric",
    slug: "fontfabric",
    homepage: "https://www.fontfabric.com/",
    listingUrl: "https://www.fontfabric.com/fonts/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("fontfabric.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "TypeMates",
    slug: "typemates",
    homepage: "https://www.typemates.com/",
    listingUrl: "https://www.typemates.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typemates.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  // Batch 9
  {
    name: "DK Type",
    slug: "dktype",
    homepage: "https://dktype.com/",
    listingUrl: "https://dktype.com/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("dktype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Souvenir Typefaces",
    slug: "souvenir-typefaces",
    homepage: "https://souvenirtypefaces.xyz/",
    listingUrl: "https://souvenirtypefaces.xyz/",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("souvenirtypefaces.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "The Northern Block",
    slug: "the-northern-block",
    homepage: "https://www.thenorthernblock.co.uk/",
    listingUrl: "https://www.thenorthernblock.co.uk/fonts",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("thenorthernblock.co.uk")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 3 && parts[0] === "fonts" && parts[1] === "p" && !NON_TYPEFACE_SLUGS.has(parts[2]);
      } catch { return false; }
    },
  },
  {
    name: "Type of Feeling",
    slug: "type-of-feeling",
    homepage: "https://typeoffeeling.com/",
    listingUrl: "https://typeoffeeling.com/products/",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typeoffeeling.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  // Batch 10
  {
    name: "Studio Feixen Fonts",
    slug: "studio-feixen-fonts",
    homepage: "https://fonts.studiofeixen.ch/",
    listingUrl: "https://fonts.studiofeixen.ch/",
    tier: "best",
    // typeface pages at /{slug} — default filter matches depth 1 from homepage
  },
  {
    name: "Just Another Foundry",
    slug: "just-another-foundry",
    homepage: "https://justanotherfoundry.com/",
    listingUrl: "https://justanotherfoundry.com/",
    tier: "okay",
    // typeface pages at /{slug} — default filter matches depth 1 from homepage
  },
  {
    name: "Lettermin",
    slug: "lettermin",
    homepage: "https://lettermin.com/",
    listingUrl: "https://lettermin.com/fonts",
    tier: "okay",
  },
  {
    name: "Studio Triple",
    slug: "studio-triple",
    homepage: "https://studiotriple.fr/",
    listingUrl: "https://studiotriple.fr/travaux/typefaces/",
    tier: "okay",
  },
  {
    name: "ALT.tf",
    slug: "alt-tf",
    homepage: "https://alt-tf.com/",
    listingUrl: "https://alt-tf.com/collections/all",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("alt-tf.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Black Foundry",
    slug: "black-foundry",
    homepage: "https://black-foundry.com/",
    listingUrl: "https://black-foundry.com/fonts/",
    tier: "okay",
  },
  {
    name: "lo-ol Type",
    slug: "lo-ol-type",
    homepage: "https://lo-ol.design/",
    listingUrl: "https://lo-ol.design/catalog",
    tier: "okay",
    scrollCount: 40,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("lo-ol.design")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "catalog" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Regular Bold Italic",
    slug: "regular-bold-italic",
    homepage: "https://regularbolditalic.com/",
    listingUrl: "https://regularbolditalic.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("regularbolditalic.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Dot Colon",
    slug: "dot-colon",
    homepage: "https://dotcolon.net/",
    listingUrl: "https://dotcolon.net/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("dotcolon.net")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Rosetta",
    slug: "rosetta",
    homepage: "https://rosettatype.com/",
    listingUrl: "https://rosettatype.com/fonts/",
    tier: "notgood",
    // typeface pages at root /{Name} (CamelCase) — exclude nav and shop subdomain
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "rosettatype.com") return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const slug = parts[0].toLowerCase();
        const ROSETTA_NAV = new Set(["fonts", "research", "articles", "fonts-in-use", "products", "licence", "feed.xml"]);
        return !NON_TYPEFACE_SLUGS.has(slug) && !ROSETTA_NAV.has(slug);
      } catch { return false; }
    },
  },
  {
    name: "TYPE BY",
    slug: "type-by",
    homepage: "https://www.typeby.com/",
    listingUrl: "https://www.typeby.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typeby.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Process Type Foundry",
    slug: "process-type-foundry",
    homepage: "https://processtypefoundry.com/",
    listingUrl: "https://processtypefoundry.com/fonts/",
    tier: "notgood",
    // site links both /fonts/slug and /fonts/slug/ — only accept trailing-slash canonical form
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("processtypefoundry.com")) return false;
        if (u.search || u.hash) return false;
        if (!u.pathname.endsWith("/")) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Monokrom",
    slug: "monokrom",
    homepage: "https://monokrom.no/",
    listingUrl: "https://monokrom.no/catalogue",
    tier: "notgood",
    // typeface pages at /fonts/{slug}, not /catalogue/{slug}
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("monokrom.no")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Collletttivo",
    slug: "collletttivo",
    homepage: "https://collletttivo.it/",
    listingUrl: "https://collletttivo.it/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("collletttivo.it")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Off Type",
    slug: "off-type",
    homepage: "https://off-type.com/",
    listingUrl: "https://off-type.com/collections/all",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("off-type.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Patio Foundry",
    slug: "patio-foundry",
    homepage: "https://patiofoundry.com/",
    listingUrl: "https://patiofoundry.com/fonts",
    tier: "okay",
  },
  {
    name: "Smuss Type Kiosk",
    slug: "smuss-type-kiosk",
    homepage: "https://typekiosk.smuss.studio/",
    listingUrl: "https://typekiosk.smuss.studio/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("smuss.studio")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const SMUSS_NAV = new Set(["buy", "about", "contact", "imprint"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !SMUSS_NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "ATYPICAL",
    slug: "atypical",
    homepage: "https://atypical.gr/",
    listingUrl: "https://atypical.gr/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("atypical.gr")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Gallery Type",
    slug: "gallery-type",
    homepage: "https://gallerytype.com/",
    listingUrl: "https://gallerytype.com/fonts",
    tier: "okay",
  },
  {
    name: "Zetafonts",
    slug: "zetafonts",
    homepage: "https://zetafonts.com/",
    listingUrl: "https://zetafonts.com/collections",
    tier: "okay",
    // typeface pages at root /{slug} (redirects to www.zetafonts.com); exclude nav pages
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("zetafonts.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const ZETA_NAV = new Set(["collections", "packs", "user", "custom-projects", "licensing", "support", "about-us", "contact-us", "store", "typeclub"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !ZETA_NAV.has(parts[0]);
      } catch { return false; }
    },
  },
  // Batch 11
  {
    name: "Store Norske Skriftkompani",
    slug: "store-norske-skriftkompani",
    homepage: "https://skriftkompani.no/",
    listingUrl: "https://skriftkompani.no/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("skriftkompani.no")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Latinotype",
    slug: "latinotype",
    homepage: "https://www.latinotype.com/",
    listingUrl: "https://www.latinotype.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("latinotype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Fonts from Folch",
    slug: "fonts-from-folch",
    homepage: "https://www.fontsfromfolch.com/",
    listingUrl: "https://www.fontsfromfolch.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("fontsfromfolch.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Brandon Nickerson",
    slug: "brandon-nickerson",
    homepage: "https://www.bnicks.com/",
    listingUrl: "https://www.bnicks.com/shop",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("bnicks.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "shop" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Formerly Known",
    slug: "formerly-known",
    homepage: "https://formerly-known.com/",
    listingUrl: "https://formerly-known.com/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("formerly-known.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "R-Typography",
    slug: "r-typography",
    homepage: "https://www.r-typography.com/",
    listingUrl: "https://www.r-typography.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("r-typography.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  // ---- Batch 12 ----
  {
    name: "A is for",
    slug: "a-is-for",
    homepage: "https://aisforfonts.com/",
    listingUrl: "https://aisforfonts.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("aisforfonts.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && parts[0] !== "fonts";
      } catch { return false; }
    },
  },
  {
    name: "A Practice for Everyday Life",
    slug: "a-practice-for-everyday-life",
    homepage: "https://apracticeforeverydaylife.com/",
    listingUrl: "https://apracticeforeverydaylife.com/type-foundry/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("apracticeforeverydaylife.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "ArrowType",
    slug: "arrowtype",
    homepage: "https://www.arrowtype.com/",
    listingUrl: "https://www.arrowtype.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("arrowtype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["trial-fonts", "licensing", "customer-login", "about", "contact", "press"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Boulevard LAB",
    slug: "boulevard-lab",
    homepage: "https://boulevardlab.com/",
    listingUrl: "https://boulevardlab.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("boulevardlab.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["Mobile-Menu", "Home", "Typefaces", "Information", "Desktop-License", "mobile-menu", "home", "typefaces", "information", "desktop-license"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0].toLowerCase()) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "b•v-h type",
    slug: "bvh-type",
    homepage: "https://bvhtype.com/",
    listingUrl: "https://bvhtype.com/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("bvhtype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Central Type",
    slug: "central-type",
    homepage: "https://centraltype.com/",
    listingUrl: "https://centraltype.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("centraltype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["fonts", "in-use", "licenses", "trial-fonts"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "DDOTT",
    slug: "ddott",
    homepage: "https://ddott.net/",
    listingUrl: "https://ddott.net/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("ddott.net")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Delve Fonts",
    slug: "delve-fonts",
    homepage: "https://delvefonts.com/",
    listingUrl: "https://delvefonts.com/fonts/",
    tier: "okay",
    filterFn: makeTypefaceFilter("https://delvefonts.com/fonts/"),
  },
  {
    name: "David Jonathan Ross",
    slug: "david-jonathan-ross",
    homepage: "https://djr.com/",
    listingUrl: "https://djr.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "djr.com" && u.hostname !== "www.djr.com") return false;
        if (u.search || u.hash || u.pathname.includes(".")) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["notes", "subscribe", "fonts-in-use-submissions", "font-of-the-month-club", "slight-chance"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]) && parts[0] === parts[0].toLowerCase();
      } catch { return false; }
    },
  },
  {
    name: "Feliciano Type",
    slug: "feliciano-type",
    homepage: "https://felicianotype.com/",
    listingUrl: "https://felicianotype.com/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("felicianotype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Flood Fonts",
    slug: "flood-fonts",
    homepage: "https://floodfonts.com/",
    listingUrl: "https://floodfonts.com/",
    tier: "okay",
    filterFn: makeTypefaceFilter("https://floodfonts.com/"),
  },
  {
    name: "Fonderie Bretagne",
    slug: "fonderie-bretagne",
    homepage: "https://fonderiebretagne.fr/",
    listingUrl: "https://fonderiebretagne.fr/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("fonderiebretagne.fr")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "font" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  // ---- Batch 13 ----
  {
    name: "Forgotten Shapes",
    slug: "forgotten-shapes",
    homepage: "https://forgotten-shapes.com/",
    listingUrl: "https://forgotten-shapes.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("forgotten-shapes.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["information", "undefined", "about", "contact"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Formagari",
    slug: "formagari",
    homepage: "https://formagari.com/",
    listingUrl: "https://formagari.com/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("formagari.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Good Type Foundry",
    slug: "good-type-foundry",
    homepage: "https://goodtypefoundry.com/",
    listingUrl: "https://goodtypefoundry.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("goodtypefoundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (u.pathname.endsWith("/")) return false; // reject trailing-slash dupes
        const skip = new Set(["custom-fonts", "goods", "my-account", "eula", "career", "trial-fonts"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Güneş Muhittin",
    slug: "gunes-muhittin",
    homepage: "https://www.gunesmuhittin.com/",
    listingUrl: "https://www.gunesmuhittin.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("gunesmuhittin.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Heavyweight",
    slug: "heavyweight",
    homepage: "https://heavyweight-type.com/",
    listingUrl: "https://heavyweight-type.com/fonts/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("heavyweight-type.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Increments",
    slug: "increments",
    homepage: "https://www.increments.cc/",
    listingUrl: "https://www.increments.cc/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("increments.cc")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Jessica Hische",
    slug: "jessica-hische",
    homepage: "https://jessicahische.shop/",
    listingUrl: "https://jessicahische.shop/collections/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("jessicahische.shop")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["gift-card"]);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]) && !skip.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Juri Zæch",
    slug: "juri-zaech",
    homepage: "https://www.juri-zaech.com/",
    listingUrl: "https://www.juri-zaech.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("juri-zaech.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  // ---- Batch 14 ----
  {
    name: "Labor and Wait",
    slug: "labor-and-wait",
    homepage: "https://www.laborandwait.xyz/",
    listingUrl: "https://www.laborandwait.xyz/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("laborandwait.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Mass-Driver",
    slug: "mass-driver",
    homepage: "https://mass-driver.com/",
    listingUrl: "https://mass-driver.com/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("mass-driver.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Nootype",
    slug: "nootype",
    homepage: "https://nootype.com/",
    listingUrl: "https://nootype.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("nootype.com")) return false;
        if (u.search || u.hash) return false;
        const name = u.pathname.replace(/\/$/, "").split("/").pop() ?? "";
        return name.startsWith("show-") && name.endsWith(".html");
      } catch { return false; }
    },
  },
  {
    name: "Nuform Type",
    slug: "nuform-type",
    homepage: "https://nuformtype.com/",
    listingUrl: "https://nuformtype.com/",
    tier: "okay",
    filterFn: makeTypefaceFilter("https://nuformtype.com/"),
  },
  {
    name: "November",
    slug: "november",
    homepage: "https://www.nvmbr.in/",
    listingUrl: "https://www.nvmbr.in/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("nvmbr.in")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Old City Mailroom",
    slug: "old-city-mailroom",
    homepage: "https://www.oldcitymailroom.com/",
    listingUrl: "https://www.oldcitymailroom.com/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("oldcitymailroom.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["full-collection", "eula", "the-vault", "purchase-index-mono"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Plain Form",
    slug: "plain-form",
    homepage: "https://plain-form.com/",
    listingUrl: "https://plain-form.com/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("plain-form.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Polytype",
    slug: "polytype",
    homepage: "https://polytype.co.uk/",
    listingUrl: "https://polytype.co.uk/typefaces",
    tier: "okay",
    scrollCount: 5,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "polytype.co.uk") return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const skip = new Set(["index", "typefaces", "info", "basket"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !skip.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "SM",
    slug: "sm",
    homepage: "https://s-m.nu/",
    listingUrl: "https://s-m.nu/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("s-m.nu")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "S6 Foundry",
    slug: "s6-foundry",
    homepage: "https://www.s6foundry.com/",
    listingUrl: "https://www.s6foundry.com/retail-font-library/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("s6foundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "retail-font-library" && parts[1].endsWith("-font-family");
      } catch { return false; }
    },
  },
  // ---- Batch 15 ----
  {
    name: "Supertype",
    slug: "supertype",
    homepage: "https://supertype.de/",
    listingUrl: "https://supertype.de/fonts/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("supertype.de")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Tunera",
    slug: "tunera",
    homepage: "https://www.tunera.xyz/",
    listingUrl: "https://www.tunera.xyz/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("tunera.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Typozon",
    slug: "typozon",
    homepage: "https://typozon.xyz/",
    listingUrl: "https://typozon.xyz/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typozon.xyz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Vectro",
    slug: "vectro",
    homepage: "https://www.vectrotype.com/",
    listingUrl: "https://www.vectrotype.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "www.vectrotype.com" && u.hostname !== "vectrotype.com") return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const VECTRO_NAV = new Set(["fonts","tester","blog","studio","sign-in","trial-fonts","licensing","terms","privacy"]);
        return parts.length === 1 && !VECTRO_NAV.has(parts[0]) && !NON_TYPEFACE_SLUGS.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Vocal Type",
    slug: "vocal-type",
    homepage: "https://www.vocaltype.co/",
    listingUrl: "https://www.vocaltype.co/typefaces",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("vocaltype.co")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "history-of" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Weekend Type",
    slug: "weekend-type",
    homepage: "https://weekendtype.xyz/",
    listingUrl: "https://weekendtype.xyz/catalogue",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (u.hostname !== "weekendtype.xyz" && u.hostname !== "www.weekendtype.xyz") return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const WEEKEND_NAV = new Set(["catalogue","custom","trials-pop-up","in-use-gallery","about"]);
        return parts.length === 1 && !WEEKEND_NAV.has(parts[0]) && !NON_TYPEFACE_SLUGS.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "WiseType",
    slug: "wisetype",
    homepage: "https://wisetype.nl/",
    listingUrl: "https://wisetype.nl/typefaces/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("wisetype.nl")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Yeahright Type",
    slug: "yeahright-type",
    homepage: "https://yeahrighttype.com/",
    listingUrl: "https://yeahrighttype.com/yeahright-type-studio",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("yeahrighttype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const YEAHRIGHT_SKIP = new Set(["yrt-year-one-bundle","collection-1","the-yeahright-type-bundle-vol-2","pocket-edition-type-bundle-vol-1","commercial-license"]);
        return parts.length === 3 && parts[0] === "yeahright-type-studio" && parts[1] === "p" && !NON_TYPEFACE_SLUGS.has(parts[2]) && !YEAHRIGHT_SKIP.has(parts[2]);
      } catch { return false; }
    },
  },
  // ---- Batch 16 ----
  // Family Type (familytype.co) skipped: SPA with no URL routing per typeface.
  // DKType already indexed in Batch 9.
  {
    name: "Power Type",
    slug: "power-type",
    homepage: "https://power-type.com/",
    listingUrl: "https://power-type.com/",
    tier: "best",
    scrollCount: 30,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("power-type.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const POWER_SKIP = new Set(["articles", "font-in-use", "privacy-policy", "cookie-policy", "eula", "font-license", "type-school"]);
        return parts.length === 1 && !NON_TYPEFACE_SLUGS.has(parts[0]) && !POWER_SKIP.has(parts[0]);
      } catch { return false; }
    },
  },
  {
    name: "Source Type",
    slug: "source-type",
    homepage: "https://www.sourcetype.com/",
    listingUrl: "https://www.sourcetype.com/typefaces",
    tier: "best",
    scrollCount: 30,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("sourcetype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 3 && parts[0] === "typefaces" && /^\d+$/.test(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Out of the Dark",
    slug: "out-of-the-dark",
    homepage: "https://www.outofthedark.swiss/",
    listingUrl: "https://www.outofthedark.swiss/",
    tier: "best",
    // Site homepage links only to specimen PDFs, not HTML typeface pages.
    // Typeface pages exist at /{lowercase-name} — enumerated from PDF hrefs.
    staticUrls: [
      "https://www.outofthedark.swiss/atak",
      "https://www.outofthedark.swiss/blitz",
      "https://www.outofthedark.swiss/copy",
      "https://www.outofthedark.swiss/cosplay",
      "https://www.outofthedark.swiss/crack",
      "https://www.outofthedark.swiss/gaya",
      "https://www.outofthedark.swiss/gza",
      "https://www.outofthedark.swiss/hammer",
      "https://www.outofthedark.swiss/handwerk",
      "https://www.outofthedark.swiss/monoform",
      "https://www.outofthedark.swiss/plakat",
      "https://www.outofthedark.swiss/play-extra",
      "https://www.outofthedark.swiss/protokoll",
      "https://www.outofthedark.swiss/quick",
      "https://www.outofthedark.swiss/rauschen-a",
      "https://www.outofthedark.swiss/rauschen-b",
      "https://www.outofthedark.swiss/rauschen-max",
      "https://www.outofthedark.swiss/raw",
      "https://www.outofthedark.swiss/remix-a",
      "https://www.outofthedark.swiss/remix-b",
      "https://www.outofthedark.swiss/resonanz-a",
      "https://www.outofthedark.swiss/resonanz-b",
      "https://www.outofthedark.swiss/rza",
      "https://www.outofthedark.swiss/solow",
      "https://www.outofthedark.swiss/subsans",
      "https://www.outofthedark.swiss/syncro",
      "https://www.outofthedark.swiss/toy",
    ],
  },
  {
    name: "Nouvelle Noire",
    slug: "nouvelle-noire",
    homepage: "https://nouvellenoire.ch/",
    listingUrl: "https://nouvellenoire.ch/type-collection/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("nouvellenoire.ch")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "product" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Tokotype",
    slug: "tokotype",
    homepage: "https://www.tokotype.com/",
    listingUrl: "https://www.tokotype.com/fonts",
    tier: "okay",
    // /fonts listing only exposes /purchase subpaths for most fonts; use staticUrls.
    staticUrls: [
      "https://www.tokotype.com/fonts/sinar-grotesk",
      "https://www.tokotype.com/fonts/fonetika",
      "https://www.tokotype.com/fonts/gramatika",
      "https://www.tokotype.com/fonts/aksen",
      "https://www.tokotype.com/fonts/makro",
      "https://www.tokotype.com/fonts/frasa",
      "https://www.tokotype.com/fonts/leksikal-sans",
      "https://www.tokotype.com/fonts/maleo",
      "https://www.tokotype.com/fonts/nomina",
    ],
  },
  {
    name: "Type Department",
    slug: "type-department",
    homepage: "https://type-department.com/",
    listingUrl: "https://type-department.com/collections/browse-all-fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("type-department.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Tropical Type",
    slug: "tropical-type",
    homepage: "https://tropicaltype.com/",
    listingUrl: "https://tropicaltype.com/collections/all",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("tropicaltype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Contemporary Type",
    slug: "contemporary-type",
    homepage: "https://contemporarytype.com/",
    listingUrl: "https://contemporarytype.com/fonts",
    tier: "okay",
  },
  {
    name: "Fontshare",
    slug: "fontshare",
    homepage: "https://www.fontshare.com/",
    listingUrl: "https://www.fontshare.com/fonts",
    tier: "okay",
    // Listing page uses React SPA — fonts don't appear as <a> tags.
    // Full font list from public API: api.fontshare.com/v2/fonts?limit=200
    staticUrls: [
      "https://www.fontshare.com/fonts/satoshi",
      "https://www.fontshare.com/fonts/clash-display",
      "https://www.fontshare.com/fonts/general-sans",
      "https://www.fontshare.com/fonts/cabinet-grotesk",
      "https://www.fontshare.com/fonts/ranade",
      "https://www.fontshare.com/fonts/chillax",
      "https://www.fontshare.com/fonts/clash-grotesk",
      "https://www.fontshare.com/fonts/switzer",
      "https://www.fontshare.com/fonts/panchang",
      "https://www.fontshare.com/fonts/stardom",
      "https://www.fontshare.com/fonts/zodiak",
      "https://www.fontshare.com/fonts/sentient",
      "https://www.fontshare.com/fonts/supreme",
      "https://www.fontshare.com/fonts/boska",
      "https://www.fontshare.com/fonts/author",
      "https://www.fontshare.com/fonts/telma",
      "https://www.fontshare.com/fonts/bespoke-serif",
      "https://www.fontshare.com/fonts/gambetta",
      "https://www.fontshare.com/fonts/tanker",
      "https://www.fontshare.com/fonts/excon",
      "https://www.fontshare.com/fonts/gambarino",
      "https://www.fontshare.com/fonts/neco",
      "https://www.fontshare.com/fonts/alpino",
      "https://www.fontshare.com/fonts/quilon",
      "https://www.fontshare.com/fonts/pally",
      "https://www.fontshare.com/fonts/bespoke-sans",
      "https://www.fontshare.com/fonts/erode",
      "https://www.fontshare.com/fonts/pencerio",
      "https://www.fontshare.com/fonts/nippo",
      "https://www.fontshare.com/fonts/sharpie",
      "https://www.fontshare.com/fonts/pramukh-rounded",
      "https://www.fontshare.com/fonts/plein",
      "https://www.fontshare.com/fonts/bespoke-stencil",
      "https://www.fontshare.com/fonts/amulya",
      "https://www.fontshare.com/fonts/bevellier",
      "https://www.fontshare.com/fonts/synonym",
      "https://www.fontshare.com/fonts/bonny",
      "https://www.fontshare.com/fonts/comico",
      "https://www.fontshare.com/fonts/rowan",
      "https://www.fontshare.com/fonts/aktura",
      "https://www.fontshare.com/fonts/technor",
      "https://www.fontshare.com/fonts/bespoke-slab",
      "https://www.fontshare.com/fonts/britney",
      "https://www.fontshare.com/fonts/array",
      "https://www.fontshare.com/fonts/styro",
      "https://www.fontshare.com/fonts/recia",
      "https://www.fontshare.com/fonts/melodrama",
      "https://www.fontshare.com/fonts/rosaline",
      "https://www.fontshare.com/fonts/hoover",
      "https://www.fontshare.com/fonts/trench-slab",
      "https://www.fontshare.com/fonts/chubbo",
      "https://www.fontshare.com/fonts/boxing",
      "https://www.fontshare.com/fonts/kola",
      "https://www.fontshare.com/fonts/rx-100",
      "https://www.fontshare.com/fonts/paquito",
      "https://www.fontshare.com/fonts/zina",
      "https://www.fontshare.com/fonts/tabular",
      "https://www.fontshare.com/fonts/expose",
      "https://www.fontshare.com/fonts/segment",
      "https://www.fontshare.com/fonts/kihim",
      "https://www.fontshare.com/fonts/pilcrow-rounded",
      "https://www.fontshare.com/fonts/striper",
      "https://www.fontshare.com/fonts/new-title",
      "https://www.fontshare.com/fonts/kohinoor-zerone",
      "https://www.fontshare.com/fonts/nunito",
      "https://www.fontshare.com/fonts/anton",
      "https://www.fontshare.com/fonts/poppins",
      "https://www.fontshare.com/fonts/khand",
      "https://www.fontshare.com/fonts/lora",
      "https://www.fontshare.com/fonts/asap",
      "https://www.fontshare.com/fonts/quicksand",
      "https://www.fontshare.com/fonts/crimson-pro",
      "https://www.fontshare.com/fonts/literata",
      "https://www.fontshare.com/fonts/sora",
      "https://www.fontshare.com/fonts/space-grotesk",
      "https://www.fontshare.com/fonts/azeret-mono",
      "https://www.fontshare.com/fonts/rajdhani",
      "https://www.fontshare.com/fonts/hind",
      "https://www.fontshare.com/fonts/roundo",
      "https://www.fontshare.com/fonts/teko",
      "https://www.fontshare.com/fonts/dancing-script",
      "https://www.fontshare.com/fonts/plus-jakarta-sans",
      "https://www.fontshare.com/fonts/kalam",
      "https://www.fontshare.com/fonts/merriweather-sans",
      "https://www.fontshare.com/fonts/red-hat-display",
      "https://www.fontshare.com/fonts/jet-brains-mono",
      "https://www.fontshare.com/fonts/fira-sans",
      "https://www.fontshare.com/fonts/oswald",
      "https://www.fontshare.com/fonts/outfit",
      "https://www.fontshare.com/fonts/work-sans",
      "https://www.fontshare.com/fonts/public-sans",
      "https://www.fontshare.com/fonts/karma",
      "https://www.fontshare.com/fonts/familjen-grotesk",
      "https://www.fontshare.com/fonts/manrope",
      "https://www.fontshare.com/fonts/spline-sans",
      "https://www.fontshare.com/fonts/archivo",
      "https://www.fontshare.com/fonts/bebas-neue",
      "https://www.fontshare.com/fonts/montserrat",
      "https://www.fontshare.com/fonts/epilogue",
      "https://www.fontshare.com/fonts/beVietnam-pro",
    ],
  },
  // ---- Batch 17 ----
  {
    name: "Approximate Type",
    slug: "approximate-type",
    homepage: "https://approxtype.com/",
    listingUrl: "https://approxtype.com/typefaces",
    tier: "okay",
    // listing page HTML contains all typeface links; use staticUrls for reliability
    staticUrls: [
      "https://approxtype.com/typefaces/canopy",
      "https://approxtype.com/typefaces/reply",
      "https://approxtype.com/typefaces/skanner",
      "https://approxtype.com/typefaces/stick",
      "https://approxtype.com/typefaces/medley",
      "https://approxtype.com/typefaces/clerk",
      "https://approxtype.com/typefaces/aguzzo",
    ],
  },
  {
    name: "Superior Type",
    slug: "superior-type",
    homepage: "https://superiortype.com/",
    listingUrl: "https://superiortype.com/fonts",
    tier: "okay",
    scrollCount: 30,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("superiortype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "type.today",
    slug: "type-today",
    homepage: "https://type.today/en",
    listingUrl: "https://type.today/en",
    tier: "okay",
    scrollCount: 40,
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("type.today")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const TYPE_TODAY_SKIP = new Set(["about", "cart", "faq", "journal", "license", "rules", "ru", "en"]);
        return parts.length === 2 && parts[0] === "en" && !TYPE_TODAY_SKIP.has(parts[1]) && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Wabi Sabi Type",
    slug: "wabi-sabi-type",
    homepage: "https://wabisabitypeshop.com/",
    listingUrl: "https://wabisabitypeshop.com/collections/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("wabisabitypeshop.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "JP Flexner",
    slug: "jp-flexner",
    homepage: "https://www.jpflexner.com/",
    listingUrl: "https://www.jpflexner.com/fonts-1",
    tier: "okay",
    staticUrls: [
      "https://www.jpflexner.com/blackbird-roman-1",
      "https://www.jpflexner.com/blackbird-script-1",
      "https://www.jpflexner.com/fairmount-gothic-round",
      "https://www.jpflexner.com/fairmount-gothic-sharp",
      "https://www.jpflexner.com/ncbc-condensed",
      "https://www.jpflexner.com/ncbc-display",
      "https://www.jpflexner.com/trusty-serif-medium",
      "https://www.jpflexner.com/trusty-serif-tall",
      "https://www.jpflexner.com/trusty-serif-wide",
    ],
  },
  {
    name: "The Temporary State",
    slug: "the-temporary-state",
    homepage: "https://type.tmpstate.net/",
    listingUrl: "https://type.tmpstate.net/",
    tier: "okay",
    staticUrls: [
      "https://type.tmpstate.net/shop/fyl",
      "https://type.tmpstate.net/shop/gramatika",
      "https://type.tmpstate.net/shop/kommuna",
      "https://type.tmpstate.net/shop/literatura",
      "https://type.tmpstate.net/shop/manege",
      "https://type.tmpstate.net/shop/panama",
      "https://type.tmpstate.net/shop/soyuz-grotesk",
      "https://type.tmpstate.net/shop/steinbeck",
      "https://type.tmpstate.net/shop/wremena",
    ],
  },
  {
    name: "Tofu Type",
    slug: "tofu-type",
    homepage: "https://tofutype.ca/",
    listingUrl: "https://tofutype.ca/",
    tier: "best",
    staticUrls: [
      "https://tofutype.ca/meiros/",
      "https://tofutype.ca/demur/",
      "https://tofutype.ca/renwick/",
      "https://tofutype.ca/mosko/",
      "https://tofutype.ca/ice-tray/",
      "https://tofutype.ca/for-the-record/",
    ],
  },
  {
    name: "Uncut",
    slug: "uncut",
    homepage: "https://uncut.wtf/",
    listingUrl: "https://uncut.wtf/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("uncut.wtf")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        const CATS = new Set(["sans-serif", "serif", "monospace", "display", "slab"]);
        return parts.length === 2 && CATS.has(parts[0]) && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 20 ----
  {
    name: "F37 Foundry",
    slug: "f37-foundry",
    homepage: "https://f37foundry.com/",
    listingUrl: "https://f37foundry.com/font-library",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("f37foundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Open Foundry",
    slug: "open-foundry",
    homepage: "https://open-foundry.com/",
    listingUrl: "https://open-foundry.com/fonts",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("open-foundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Free Faces",
    slug: "free-faces",
    homepage: "https://www.freefaces.gallery/",
    listingUrl: "https://www.freefaces.gallery/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("freefaces.gallery")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 19 ----
  {
    name: "Atipo Foundry",
    slug: "atipo-foundry",
    homepage: "https://www.atipofoundry.com/",
    listingUrl: "https://www.atipofoundry.com/fonts",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("atipofoundry.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Dinamo Typefaces",
    slug: "dinamo-typefaces",
    homepage: "https://abcdinamo.com/",
    listingUrl: "https://abcdinamo.com/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("abcdinamo.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typefaces" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Displaay Type Foundry",
    slug: "displaay-type-foundry",
    homepage: "https://displaay.net/",
    listingUrl: "https://displaay.net/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("displaay.net")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Grilli Type",
    slug: "grilli-type",
    homepage: "https://www.grillitype.com/",
    listingUrl: "https://www.grillitype.com/typefaces",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("grillitype.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "typeface" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Klim Type Foundry",
    slug: "klim-type-foundry",
    homepage: "https://klim.co.nz/",
    listingUrl: "https://klim.co.nz/retail-fonts",
    tier: "best",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("klim.co.nz")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "fonts" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Pangram Pangram Foundry",
    slug: "pangram-pangram-foundry",
    homepage: "https://pangrampangram.com/",
    listingUrl: "https://pangrampangram.com/collections/fonts",
    tier: "best",
    // Shopify store: typefaces at /products/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("pangrampangram.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 18 ----
  {
    name: "6TM Magazine",
    slug: "6tm-magazine",
    homepage: "https://shop.6tm-magazine.com/",
    listingUrl: "https://shop.6tm-magazine.com/collections/fonts",
    tier: "okay",
    // Shopify: typefaces at /products/[slug]
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("6tm-magazine.com")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "products" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },

  // ---- Batch 21 ----
  {
    name: "U+270D",
    slug: "u270d",
    homepage: "https://u270d.eesab.fr/",
    listingUrl: "https://u270d.eesab.fr/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("u270d.eesab.fr")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length === 2 && parts[0] === "projets" && !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "X Cicéro",
    slug: "x-cicero",
    homepage: "https://xcicero.esad-gv.net/",
    listingUrl: "https://xcicero.esad-gv.net/",
    tier: "okay",
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("xcicero.esad-gv.net")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        // URL pattern is /page/:slug/ (sometimes /page/:slug/index.php)
        if (parts.length < 2 || parts[0] !== "page") return false;
        return !NON_TYPEFACE_SLUGS.has(parts[1]);
      } catch { return false; }
    },
  },
  {
    name: "Lewis McGuffie",
    slug: "lewis-mcguffie",
    homepage: "https://www.lewismcguffie.com/",
    listingUrl: "https://www.lewismcguffie.com/",
    tier: "okay",
    staticUrls: [
      "https://www.lewismcguffie.com/Tekst-Roman",
      "https://www.lewismcguffie.com/Jooks-Script-9B",
    ],
  },
];

// ---- URL filter ----
// Matches any internal link exactly one path-level deeper than the listing URL.
// Strips query strings so ?set= script variants (Lineto) don't appear as separate entries.
function makeTypefaceFilter(listingUrl) {
  const base = new URL(listingUrl);
  const domain = base.hostname;
  const baseParts = base.pathname.replace(/\/$/, "").split("/").filter(Boolean);

  return (href) => {
    try {
      const u = new URL(href);
      if (u.hostname !== domain) return false;
      if (u.search) return false; // query-string URLs are variants, not distinct typefaces
      if (u.hash) return false;   // hash fragments are anchor links to the same page
      const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts.length !== baseParts.length + 1) return false;
      for (let i = 0; i < baseParts.length; i++) {
        if (parts[i] !== baseParts[i]) return false;
      }
      const slug = parts[parts.length - 1];
      return !NON_TYPEFACE_SLUGS.has(slug);
    } catch {
      return false;
    }
  };
}

// ---- Claude schema ----
const TYPEFACE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    foundry: { type: "string" },
    url: { type: "string" },
    designer: { anyOf: [{ type: "string" }, { type: "null" }] },
    year: { anyOf: [{ type: "integer" }, { type: "null" }] },
    category: {
      type: "string",
      enum: ["serif", "sans-serif", "slab", "display", "mono", "script", "blackletter"],
    },
    subcategory: { type: "string" },
    classification_notes: { type: "string" },
    weights: { type: "array", items: { type: "string" } },
    optical_sizes_or_widths: { type: "array", items: { type: "string" } },
    subfamilies: { type: "array", items: { type: "string" } },
    has_condensed: { type: "boolean" },
    has_italic: { type: "boolean" },
    has_mono: { type: "boolean" },
    languages: { type: "array", items: { type: "string" } },
    tier: { type: "string", enum: ["best", "okay", "loose", "notgood"] },
    type: { type: "string", enum: ["foundry", "reseller", "free"] },
    tags: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    description: { type: "string" },
    foundry_blurb: { type: "string" },
  },
  required: [
    "name", "foundry", "url", "designer", "year", "category", "subcategory",
    "classification_notes", "weights", "optical_sizes_or_widths", "subfamilies",
    "has_condensed", "has_italic", "has_mono", "languages", "tier", "type",
    "tags", "summary", "description", "foundry_blurb",
  ],
  additionalProperties: false,
};

// ---- System prompt (cached) ----
const EXAMPLE = JSON.parse(readFileSync(join(root, "data/typefaces-klim.json"), "utf8"))[0];

const SYSTEM_PROMPT = `You produce structured typeface entries for a curated type directory. Given text scraped from a typeface's web page, return a single JSON object matching the schema exactly.

FIELD GUIDE
- name: exact typeface name as shown on the page
- foundry: use the provided foundry name verbatim
- url: use the provided URL verbatim
- designer: designer name(s), null if not mentioned
- year: first release year as integer, null if unknown
- category: serif | sans-serif | slab | display | mono | script | blackletter
- subcategory: specific style e.g. "grotesque", "transitional serif", "humanist sans", "geometric sans", "slab serif"
- classification_notes: 1-2 sentences on why you chose that category/subcategory
- weights: list of named weights e.g. ["Thin", "Light", "Regular", "Medium", "Bold", "Black"]
- optical_sizes_or_widths: optical sizes or width variants e.g. ["Caption", "Text", "Display"]; if none, use ["standard"]
- subfamilies: named sub-families e.g. ["Acumin Pro", "Acumin Pro Condensed", "Acumin Pro Wide"]; if just one family, use [name]
- has_condensed: true if any condensed or compressed cut exists
- has_italic: true if italic or oblique exists
- has_mono: true if a monospaced variant exists
- languages: script coverage e.g. ["Latin", "Cyrillic", "Greek", "Arabic"]
- tier: quality assessment —
  "best" = exceptional design, distinctive voice, historically or culturally significant
  "okay" = solid and professional, unremarkable
  "loose" = mediocre or overly generic
  "notgood" = poor quality
- type: foundry (sells own designs) | reseller | free
- tags: 4-8 lowercase descriptive tags, no spaces e.g. ["grotesque", "editorial", "geometric", "neutral"]
- summary: ONE sentence. British English. Specific, direct. No buzzwords.
- description: 2-3 sentences expanding on summary. British English. No filler.
- foundry_blurb: paraphrase of the foundry's own copy for this typeface

SCOPE WARNING
- The page may contain sections for related typefaces, "you may also like", other releases, or navigation links to other fonts. Ignore all of that entirely.
- Extract information ONLY about the specific typeface at the provided URL. Do not blend in details from any other typeface shown on the page.

WRITING STYLE for summary and description
- British English. Short sentences.
- No Oxford commas. No em dashes (use en dash or rewrite).
- Never use: delve, leverage, utilize, robust, pivotal, seamless, innovative, transformative, comprehensive, meticulous, testament, tapestry, navigate, landscape, realm, underscore, harness, foster, paramount, multifaceted, nuanced, holistic, synergy, ecosystem, empower, crucial, showcase, elevate, resonate, groundbreaking, game-changer, spearhead, catalyze, encapsulate
- Do not open with the typeface name.
- Do not assert significance. Show it through specific detail.

REFERENCE EXAMPLE (Klim Type Foundry — American Grotesk)
${JSON.stringify(EXAMPLE, null, 2)}`;

// ---- Helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function specimenPath(foundrySlug, typefaceSlug) {
  return join(SPECIMENS_DIR, foundrySlug, `${typefaceSlug}.webp`);
}

async function fetchImgBuffer(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": UA_IMG, Accept: "text/html,image/*,*/*" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractOgImage(html, pageUrl) {
  const metas = html.match(/<meta[^>]+>/gi) ?? [];
  for (const key of ["og:image", "twitter:image"]) {
    for (const m of metas) {
      if (!new RegExp(`(property|name)=["']${key}(:secure_url)?["']`, "i").test(m)) continue;
      const content = m.match(/content=["']([^"']+)["']/i);
      if (content?.[1]) {
        try { return new URL(content[1].replace(/&amp;/g, "&").trim(), pageUrl).href; }
        catch { return null; }
      }
    }
  }
  return null;
}

async function saveSpecimen(buffer, foundrySlug, typefaceSlug, position = "centre") {
  mkdirSync(join(SPECIMENS_DIR, foundrySlug), { recursive: true });
  await sharp(buffer)
    .resize(SPECIMEN_WIDTH, SPECIMEN_HEIGHT, { fit: "cover", position })
    .webp({ quality: 75 })
    .toFile(specimenPath(foundrySlug, typefaceSlug));
}

// Uses the already-loaded page (saves a second HTTP round-trip).
async function fetchSpecimenFromPage(page, foundrySlug, typefaceSlug, { specimenMinY = 0 } = {}) {
  const out = specimenPath(foundrySlug, typefaceSlug);
  if (existsSync(out)) return "cached";

  const SKIP = /logo|icon|avatar|placeholder|sprite|flag|badge/i;

  // Scroll to trigger lazy-loading of below-fold content before scanning
  if (specimenMinY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), specimenMinY);
    await page.waitForTimeout(800);
  }

  // 1. Largest landscape <img> (optionally filtered by page Y position)
  const imgSrc = await page.evaluate(([skip, minY]) => {
    const SKIP_RE = new RegExp(skip);
    const candidates = [...document.querySelectorAll("img")].map((el) => ({
      src: el.currentSrc || el.src,
      w: el.naturalWidth,
      h: el.naturalHeight,
      y: el.getBoundingClientRect().top + window.scrollY,
    })).filter((c) =>
      c.src &&
      !c.src.startsWith("data:") &&
      !/\.svg(\?|$)/i.test(c.src) &&
      !SKIP_RE.test(c.src) &&
      c.w >= 400 && c.h >= 150 && c.w / c.h >= 1.2 &&
      c.y >= minY
    ).sort((a, b) => b.w * b.h - a.w * a.h);
    return candidates[0]?.src ?? null;
  }, [SKIP.source, specimenMinY]);

  if (imgSrc) {
    try {
      const buf = await fetchImgBuffer(imgSrc);
      await saveSpecimen(buf, foundrySlug, typefaceSlug);
      return "page-img";
    } catch { /* fall through */ }
  }

  // 2. Screenshot fallback (og:image intentionally skipped — foundries share site-wide og images)
  if (specimenMinY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), specimenMinY);
    await page.waitForTimeout(400);
  }
  const buf = await page.screenshot({ type: "png" });
  await saveSpecimen(buf, foundrySlug, typefaceSlug, "top");
  return "screenshot";
}

async function dismissCookies(page) {
  for (const sel of COOKIE_SELECTORS) {
    await page.locator(sel).first().click({ timeout: 600 }).catch(() => {});
  }
}

async function loadPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissCookies(page);
}

async function extractTypefaceUrls(page, foundry) {
  // staticUrls: bypass listing-page scrape entirely.
  if (foundry.staticUrls) return foundry.staticUrls;

  const filter = foundry.filterFn ?? makeTypefaceFilter(foundry.listingUrl);
  const scrollCount = foundry.scrollCount ?? 20;
  await loadPage(page, foundry.listingUrl);

  // Scroll to expose lazy-loaded links
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) {
      window.scrollBy(0, window.innerHeight);
      await new Promise((r) => setTimeout(r, 250));
    }
    window.scrollTo(0, 0);
  }, scrollCount);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.href)
      .filter((h) => h.startsWith("http"))
  );

  return [...new Set(links)].filter(filter);
}

async function extractPageContent(page, url) {
  await loadPage(page, url);

  const text = await page.evaluate(() => {
    document
      .querySelectorAll("script,style,noscript,nav,footer,header,[aria-hidden='true']")
      .forEach((el) => el.remove());
    const main =
      document.querySelector("main,[role='main'],article,#content,.content,.page-content") ??
      document.body;
    return main.innerText;
  });

  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 10000);
}

async function generateEntry(client, foundry, url, content) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: TYPEFACE_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: `Foundry: ${foundry.name}\nURL: ${url}\nType: foundry\n\nPAGE CONTENT:\n${content}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("No text block in Claude response");
  return JSON.parse(textBlock.text);
}

// ---- Main ----
async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const specimensOnly = argv.includes("--specimens-only");
  const force = argv.includes("--force");

  const foundryArgs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--foundry" && i + 1 < argv.length) {
      foundryArgs.push(argv[++i]);
    }
  }

  const toProcess = foundryArgs.length > 0
    ? FOUNDRIES.filter((f) => foundryArgs.includes(f.slug))
    : FOUNDRIES;

  if (toProcess.length === 0) {
    console.error(`Unknown foundry: ${foundryArgs.join(", ")}`);
    console.error(`Available: ${FOUNDRIES.map((f) => f.slug).join(", ")}`);
    process.exit(1);
  }

  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Add it to .env.local or export it.");
    process.exit(1);
  }

  const client = dryRun ? null : new Anthropic();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA, ignoreHTTPSErrors: true });
  const stats = { ok: 0, fail: 0 };

  try {
    for (let fi = 0; fi < toProcess.length; fi++) {
      const foundry = toProcess[fi];
      if (fi > 0) await sleep(FOUNDRY_DELAY_MS);

      console.log(`\n=== ${foundry.name} ===`);
      console.log(`Listing: ${foundry.listingUrl}`);

      const outPath = join(root, "data", `typefaces-${foundry.slug}.json`);

      // Early exit: skip foundries already fully indexed
      if (!dryRun && !specimensOnly && !force) {
        if (existsSync(outPath)) {
          const existing = JSON.parse(readFileSync(outPath, "utf8"));
          if (existing.length > 0) {
            console.log(`  Already indexed (${existing.length} entries) — skipping`);
            continue;
          }
        }
      }

      const page = await ctx.newPage();

      let urls;
      try {
        urls = await extractTypefaceUrls(page, foundry);
      } catch (err) {
        console.error(`  Listing fetch failed: ${err.message}`);
        await page.close();
        continue;
      }

      console.log(`Found ${urls.length} typeface URL(s)`);
      if (urls.length === 0) {
        console.warn("  No URLs matched – check listingUrl and URL filter (NON_TYPEFACE_SLUGS).");
        await page.close();
        continue;
      }

      if (dryRun) {
        for (const u of urls) console.log(`  ${u}`);
        await page.close();
        continue;
      }

      // Resume: load any entries already written for this foundry
      const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
      const indexed = new Set(existing.map((e) => e.url));
      const entries = [...existing];

      // Use listing page for URL extraction only, then close it
      await page.close();

      // --specimens-only: re-fetch specimens for already-indexed entries without re-generating data
      if (specimensOnly) {
        console.log(`Specimens-only: re-fetching ${existing.length} specimens`);
        for (let i = 0; i < existing.length; i += CONCURRENCY) {
          const batch = existing.slice(i, i + CONCURRENCY);
          await Promise.all(batch.map(async (entry) => {
            const typefaceSlug = slugify(entry.name);
            const specimenPage = await ctx.newPage();
            process.stdout.write(`  ${typefaceSlug} ... `);
            try {
              await loadPage(specimenPage, entry.url);
              const specimenResult = await fetchSpecimenFromPage(specimenPage, foundry.slug, typefaceSlug, { specimenMinY: foundry.specimenMinY ?? 0 });
              const manifest = existsSync(MANIFEST_PATH)
                ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
                : {};
              manifest[`${foundry.slug}/${typefaceSlug}`] = true;
              writeFileSync(MANIFEST_PATH, JSON.stringify(manifest) + "\n");
              console.log(`✓ ${entry.name} [specimen: ${specimenResult}]`);
            } catch (err) {
              console.log(`✗ ${entry.name}: ${err.message.slice(0, 80)}`);
            } finally {
              await specimenPage.close();
            }
          }));
        }
        continue;
      }

      const urlsToProcess = urls.filter((u) => !indexed.has(u));

      if (indexed.size > 0) {
        console.log(`Resuming: ${indexed.size} already indexed, ${urlsToProcess.length} remaining`);
      }

      // Process in parallel batches
      for (let i = 0; i < urlsToProcess.length; i += CONCURRENCY) {
        const batch = urlsToProcess.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (url) => {
            const slug = new URL(url).pathname.replace(/\/$/, "").split("/").pop() ?? url;
            const batchPage = await ctx.newPage();
            process.stdout.write(`  ${slug} ... `);
            try {
              const content = await extractPageContent(batchPage, url);
              const entry = await generateEntry(client, foundry, url, content);
              entries.push(entry);
              indexed.add(url);
              stats.ok++;
              writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
              const typefaceSlug = slugify(entry.name);
              try {
                const specimenResult = await fetchSpecimenFromPage(batchPage, foundry.slug, typefaceSlug, { specimenMinY: foundry.specimenMinY ?? 0 });
                console.log(`✓ ${entry.name} [specimen: ${specimenResult}]`);
                const manifest = existsSync(MANIFEST_PATH)
                  ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
                  : {};
                manifest[`${foundry.slug}/${typefaceSlug}`] = true;
                writeFileSync(MANIFEST_PATH, JSON.stringify(manifest) + "\n");
              } catch (specimenErr) {
                console.log(`✓ ${entry.name} [specimen: miss – ${specimenErr.message.slice(0, 60)}]`);
              }
            } catch (err) {
              stats.fail++;
              console.log(`✗ ${slug}: ${err.message.slice(0, 100)}`);
            } finally {
              await batchPage.close();
            }
          })
        );
        if (i + CONCURRENCY < urlsToProcess.length) await sleep(PAGE_DELAY_MS);
      }

      console.log(`\nWrote ${entries.length}/${urls.length} → data/typefaces-${foundry.slug}.json`);
    }
  } finally {
    await browser.close();
  }

  if (!dryRun) {
    console.log(`\nDone: ${stats.ok} ok, ${stats.fail} failed`);
    console.log(`
lib/foundry-map.ts and scripts/fetch-specimens.mjs are already updated.
Next: node scripts/fetch-specimens.mjs --foundry lineto (repeat per foundry), then git push.
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Crawl typeface pages from new foundries and generate data/typefaces-[slug].json via Claude.
//
// Usage:
//   node scripts/index-foundry.mjs                    # all 5 foundries
//   node scripts/index-foundry.mjs --foundry lineto   # one foundry
//   node scripts/index-foundry.mjs --dry-run          # list URLs, no Claude calls
//   INDEX_MODEL=claude-opus-4-8 node scripts/index-foundry.mjs
//
// ANTHROPIC_API_KEY is auto-loaded from .env.local if not already in env.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
const PAGE_DELAY_MS = 2000;
const FOUNDRY_DELAY_MS = 5000;
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
    listingUrl: "https://typespec.co.uk/",
    tier: "best",
    // root-level typefaces; exclude known nav slugs
    filterFn: (href) => {
      try {
        const u = new URL(href);
        if (!u.hostname.includes("typespec.co.uk")) return false;
        if (u.search || u.hash) return false;
        const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        if (parts.length !== 1) return false;
        const NAV = new Set(["custom-font-services", "buyfontssavelives"]);
        return !NON_TYPEFACE_SLUGS.has(parts[0]) && !NAV.has(parts[0]);
      } catch { return false; }
    },
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
  const foundryArg = argv.includes("--foundry") ? argv[argv.indexOf("--foundry") + 1] : null;
  const dryRun = argv.includes("--dry-run");

  const toProcess = foundryArg
    ? FOUNDRIES.filter((f) => f.slug === foundryArg)
    : FOUNDRIES;

  if (toProcess.length === 0) {
    console.error(`Unknown foundry: ${foundryArg}`);
    console.error(`Available: ${FOUNDRIES.map((f) => f.slug).join(", ")}`);
    process.exit(1);
  }

  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Add it to .env.local or export it.");
    process.exit(1);
  }

  const client = dryRun ? null : new Anthropic();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: UA });
  const stats = { ok: 0, fail: 0 };

  try {
    for (let fi = 0; fi < toProcess.length; fi++) {
      const foundry = toProcess[fi];
      if (fi > 0) await sleep(FOUNDRY_DELAY_MS);

      console.log(`\n=== ${foundry.name} ===`);
      console.log(`Listing: ${foundry.listingUrl}`);

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
      const outPath = join(root, "data", `typefaces-${foundry.slug}.json`);
      const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
      const indexed = new Set(existing.map((e) => e.url));
      const entries = [...existing];

      if (indexed.size > 0) {
        console.log(`Resuming: ${indexed.size} already indexed, ${urls.length - indexed.size} remaining`);
      }

      for (const url of urls) {
        const slug = new URL(url).pathname.replace(/\/$/, "").split("/").pop() ?? url;

        if (indexed.has(url)) {
          console.log(`  ${slug} ... skip`);
          continue;
        }

        process.stdout.write(`  ${slug} ... `);

        try {
          const content = await extractPageContent(page, url);
          await sleep(PAGE_DELAY_MS);
          const entry = await generateEntry(client, foundry, url, content);
          entries.push(entry);
          indexed.add(url);
          stats.ok++;
          console.log(`✓ ${entry.name}`);
          // Write after each entry so a kill/crash loses at most one entry
          writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
        } catch (err) {
          stats.fail++;
          console.log(`✗ ${err.message.slice(0, 100)}`);
        }

        await sleep(PAGE_DELAY_MS);
      }

      console.log(`\nWrote ${entries.length}/${urls.length} → data/typefaces-${foundry.slug}.json`);

      await page.close();
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

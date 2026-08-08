// Harvest a specimen image for every typeface in data/typefaces-*.json.
// Pass 1 takes the largest landscape <img> on the page (page-image).
// Pass 2 types the typeface name into the page's own type tester (if one is found)
// and screenshots just that element — real webfont, our own text, no page chrome.
// Pass 3 screenshots the whole page with Playwright for whatever remains.
// og:image is never used — foundries share site-wide og images across all fonts.
// Every candidate image is validated before saving: pixel stats reject near-blank
// pages, an md5 check rejects images already used by another font in the same
// foundry, and (when ANTHROPIC_API_KEY is set) Claude vision confirms the image
// actually shows type. Rejected page-images fall through to the tester pass, then
// to the full-page screenshot, which gets one retry. If a rejection looks like a
// bot-protection challenge (Cloudflare, "just a moment", etc.), the whole capture
// is retried once more through a stealth-patched browser before giving up. A
// missing image beats a junk one, so a final failure counts as a miss rather than
// saving anything.
// Output: public/specimens/[foundrySlug]/[slug].webp + lib/specimens.json.
//
// Run locally: node scripts/fetch-specimens.mjs
//   --no-vision            skip the Claude check (heuristics only)
//   --model <id>           vision model (default claude-opus-4-8; claude-haiku-4-5 for cheap sweeps)
//   --foundries a,b,c      only these foundry slugs (comma-separated, no spaces)
// Never runs on Vercel.

import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, statSync, unlinkSync as _unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { chromium } from "playwright";
import { chromium as stealthChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

stealthChromium.use(StealthPlugin());

// Matches the vision rejection reason (or a bare page title) when a bot-protection
// challenge was captured instead of the real page — worth one retry through a
// stealth-patched browser rather than accepting it as a plain miss.
// Matched against the *vision verdict text*, not page HTML, so it has to cover
// how the model describes a challenge screen as well as the vendor wording on
// it. Canada Type (403s a plain request) was reported as "Security verification
// page" / "Error page" on all 13 typefaces and never qualified for the stealth
// retry, because the old pattern only knew Cloudflare's own phrasing.
const BOT_BLOCK_RE = /cloudflare|just a moment|attention required|verify you are human|checking your browser|access denied|security verification|human verification|verification page|captcha|forbidden|rate limit/i;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "public", "specimens");
const MANIFEST = join(root, "lib", "specimens.json");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WIDTH = 640;
const HEIGHT = 400; // 16:10 to match card aspect ratio
const DOMAIN_DELAY_MS = 1500;
const DOMAIN_CONCURRENCY = 4;

// Mirrors slugify in lib/typefaces.ts.
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Mirrors lib/foundry-map.ts.
const FOUNDRY_SLUGS = {
  "ABC Etc Inc": "abc-etc",
  "atipo foundry": "atipo-foundry",
  "Avondale Type Co.": "avondale-type",
  "b•v-h type": "bvh-type",
  "Carmel Type Co.": "carmel-type",
  "Commercial Type": "commercial-type",
  "DK Type": "dktype",
  EPI: "epitype",
  "Jeremy Tankard Typography": "jeremy-tankard",
  "Jung-Lee Type Foundry": "jung-lee-type",
  "Juri Zæch": "juri-zaech",
  "Laura Worthington Design": "laura-worthington",
  "Marmite de Fontes": "marmite-defontes",
  "TØ—Labs™": "to-labs",
  "Type-ø-tones": "type-o-tones",
  "U+270D": "u270d",
  "Dalton Maag": "dalton-maag",
  "Denis Serebryakov": "serebryakov",
  "Dinamo Typefaces": "dinamo-typefaces",
  "Displaay Type Foundry": "displaay-type-foundry",
  "F37 Foundry": "f37-foundry",
  "Grilli Type": "grilli-type",
  "Hoefler & Co": "hoefler-co",
  "Klim Type Foundry": "klim-type-foundry",
  Optimo: "optimo",
  "Pangram Pangram Foundry": "pangram-pangram-foundry",
  "Schick Toikka": "schick-toikka",
  Sociotype: "sociotype",
  Lineto: "lineto",
  "Swiss Typefaces": "swiss-typefaces",
  "Production Type": "production-type",
  Newlyn: "newlyn",
  Typotheque: "typotheque",
  "OH no Type": "oh-no-type",
  Fontwerk: "fontwerk",
  CAST: "cast",
  Camelot: "camelot",
  Extraset: "extraset",
  Fatype: "fatype",
  NaN: "nan",
  Signal: "signal",
  "Blaze Type": "blaze-type",
  "a.Foundry": "a-foundry",
  AllCaps: "allcaps",
  Arillatype: "arillatype",
  "Faire Type": "faire-type",
  "British Standard Type": "british-standard-type",
  "OTT Foundry": "ott-foundry",
  "Bureau Brut": "bureau-brut",
  "A Type of Amigo": "a-type-of-amigo",
  Bastarda: "bastarda",
  "Interval Type": "interval-type",
  "Due Studio": "due-studio",
  Typespec: "typespec",
  Almarena: "almarena",
  "A2-Type": "a2-type",
  Binnenland: "binnenland",
  "Florian Karsten": "catalogue",
  Frost: "frost",
  "Groteskly Yours": "groteskly-yours",
  "General Type Studio": "general-type-studio",
  "Leinster Type": "leinster-type",
  Playtype: "playtype",
  "Studio Rene Bieder": "studio-rene-bieder",
  TIGHTYPE: "tightype",
  "The Designers Foundry": "the-designers-foundry",
  Prioritype: "prioritype",
  "Taylor Penton": "taylor-penton",
  "VJ Type": "vj-type",
  "Balto / Type Supply": "balto-type-supply",
  "Big Fog Foundry": "big-fog-foundry",
  "Coppers and Brasses": "coppers-and-brasses",
  "Darden Studio": "darden-studio",
  "Colt Type": "colt-type",
  "Dharma Type": "dharma-type",
  "Storm Type Foundry": "storm-type",
  "XYZ Type": "xyz-type",
  Kilotype: "kilotype",
  "KOMETA Typefaces": "kometa-typefaces",
  "Kurppa Hosk Type": "kurppa-hosk-type",
  Gradient: "gradient",
  "Letters from Sweden": "letters-from-sweden",
  // Batch 6
  "East of Rome": "east-of-rome",
  "Commercial Classics": "commercial-classics",
  "HvD Fonts": "hvd-fonts",
  "Connary Fagen": "connary-fagen",
  "Narrow Type": "narrow-type",
  "TypeTogether": "type-together",
  "Suitcase Type Foundry": "suitcase-type",
  "Lettermatic": "lettermatic",
  "Radim Pesko": "radim-pesko",
  "The Foundry Types": "the-foundry-types",
  "Type Forward": "type-forward",
  "Nikolas Type": "nikolas-type",
  "Death of Typography": "death-of-typography",
  "Monkey Type": "monkey-type",
  "TypeType": "type-type",
  "ECAL Typefaces": "ecal-typefaces",
  "WELTKERN": "weltkern",
  "Village": "village",
  "Dirty Line Studio": "dirty-line-studio",
  "Mojomox": "mojomox",
  "205TF": "205tf",
  "Fable": "fable",
  "Arkitype": "arkitype",
  "Crescenzi": "crescenzi",
  "Lift Type": "lift-type",
  "Ultra Kuhl": "ultra-kuhl",
  "Bold Monday": "bold-monday",
  "Letterjuice": "letterjuice",
  "SilverStag Type": "silverstag-type",
  "Milieu Grotesque": "milieu-grotesque",
  // Batch 7
  "Hot Type": "hot-type",
  "Order": "order",
  "Luzi Type": "luzi-type",
  "Double Dagger": "double-dagger",
  "Indian Type Foundry": "indian-type-foundry",
};

const COOKIE_SELECTORS = [
  // OneTrust
  "#onetrust-accept-btn-handler",
  // Cookiebot
  "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  // Funding Choices / Google consent
  ".fc-cta-consent",
  "button.fc-button-label",
  // Generic class/id patterns
  '[class*="cookie"] button[class*="accept"]',
  '[id*="cookie"] button[class*="accept"]',
  '[class*="consent"] button[class*="accept"]',
  '[class*="gdpr"] button[class*="accept"]',
  'button[aria-label*="ccept"]',
  'button[aria-label*="gree"]',
  // Named platforms
  ".cc-allow",
  ".cky-btn-accept",
  ".js-cookie-consent-agree",
  "#tarteaucitronPersonalize2",
  ".tarteaucitronAllow",
  // Generic data attributes
  'button[data-consent*="accept"]',
  'button[data-action*="accept"]',
  '[data-testid*="accept"]',
  '[data-testid*="consent"]',
];

// Text patterns for buttons that CSS selectors miss
const COOKIE_TEXT_RE = /^(accept( all( cookies)?)?|agree|ok|got it|i agree|allow( all)?|yes( please)?)$/i;

// Marketing/newsletter modals, which are a separate problem from consent walls:
// they appear on a timer *after* load, cover the page centre, and have a close
// affordance rather than an accept button, so none of the cookie handling above
// touches them. Klaviyo is the common one on Shopify storefronts — RetroSupply's
// "Summer Sale" overlay is a Klaviyo form, and it accounted for all 13 of that
// foundry's misses.
const POPUP_SELECTORS = [
  ".klaviyo-close-form",
  'button[aria-label*="close dialog" i]',
  'button[aria-label*="close modal" i]',
  'button[aria-label*="close popup" i]',
  '[class*="popup"] button[class*="close"]',
  '[class*="modal"] button[class*="close"]',
  '[class*="newsletter"] button[class*="close"]',
  "button.mfp-close",
  "button.fancybox-close-small",
];

// Close-button glyphs and dismissal wording, for modals whose close control
// carries no usable class or aria-label.
const POPUP_TEXT_RE = /^(×|✕|✖|x|close|no thanks|no,? thanks|not now|maybe later|dismiss)$/i;

function loadTypefaces() {
  const dataDir = join(root, "data");
  const files = readdirSync(dataDir).filter((f) => f.startsWith("typefaces-") && f.endsWith(".json"));
  return files.flatMap((f) => JSON.parse(readFileSync(join(dataDir, f), "utf8"))).map((t) => ({
    name: t.name,
    foundry: t.foundry,
    url: t.url,
    foundrySlug: FOUNDRY_SLUGS[t.foundry] ?? slugify(t.foundry),
    slug: slugify(t.name),
  }));
}

function outPath(t) {
  return join(OUT_DIR, t.foundrySlug, `${t.slug}.webp`);
}

// Minimum bytes for a valid specimen — anything below is likely a generic placeholder.
// Deliberately low: a *clean* specimen (big black letterforms on flat white, no
// photography or texture) is exactly the kind of image WebP compresses hardest,
// so a high floor here rejects the best-composed pages first. Synthview's
// Nerissimo — a full-width display specimen, nothing wrong with it — came in at
// 4736b and was being thrown out by the old 5000 floor. Genuinely empty captures
// land in the hundreds of bytes and are still caught, as is anything near-solid
// (the stdev check below is the real blank detector; this is just a cheap guard).
const MIN_SIZE = 2000;

// "cover" crops to fill the frame — right for near-4:3 page screenshots, but a
// tester element is often a short, very wide strip of text (e.g. 1141x120, a
// ~9.5:1 ratio). Covering that into 640x400 scales it up to fill the height,
// then crops a narrow ~640px slice out of the resulting ~3800px width — often
// landing on a gap between words and producing a near-blank result every time,
// not just unluckily. "contain" letterboxes instead, so the full line survives.
async function processWebp(buffer, position = "centre", fit = "cover") {
  return sharp(buffer)
    .resize(WIDTH, HEIGHT, { fit, position, background: "#ffffff" })
    .webp({ quality: 75 })
    .toBuffer();
}

function saveWebp(webpBuf, t) {
  mkdirSync(join(OUT_DIR, t.foundrySlug), { recursive: true });
  writeFileSync(outPath(t), webpBuf);
  return webpBuf.length;
}

// ---- Specimen validation ----
// Layered: pixel stats (free) → duplicate hash within foundry (free) → Claude vision (paid, optional).
// Vision runs only when ANTHROPIC_API_KEY is available; pass --no-vision to skip it.

const VISION_ENABLED = !process.argv.includes("--no-vision");
const modelFlag = process.argv.indexOf("--model");
const VISION_MODEL = modelFlag > -1 ? process.argv[modelFlag + 1] : "claude-opus-4-8";

// The script runs standalone, so pull the key from .env.local if the shell doesn't have it.
if (!process.env.ANTHROPIC_API_KEY && existsSync(join(root, ".env.local"))) {
  const env = readFileSync(join(root, ".env.local"), "utf8");
  const m = env.match(/^ANTHROPIC_API_KEY=["']?([^"'\n]+)/m);
  if (m) process.env.ANTHROPIC_API_KEY = m[1];
}

let anthropicClient = null;
async function getAnthropicClient() {
  if (anthropicClient === null && VISION_ENABLED && process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// md5 of every already-accepted image per foundry, so a reused banner/consent wall
// (identical bytes across fonts) is rejected. Loaded lazily from disk per foundry.
const foundryHashes = new Map();
function hashesFor(foundrySlug) {
  if (!foundryHashes.has(foundrySlug)) {
    const set = new Set();
    const dir = join(OUT_DIR, foundrySlug);
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (f === ".DS_Store") continue;
        set.add(createHash("md5").update(readFileSync(join(dir, f))).digest("hex"));
      }
    }
    foundryHashes.set(foundrySlug, set);
  }
  return foundryHashes.get(foundrySlug);
}

// Cheap, local, no-network check shared by full validation and the tester's
// retype-retry loop (see typeIntoTester callers) — near-solid images (blank page,
// consent-dimmed overlay, unrendered canvas, or a demo-text widget's auto-cycle
// interval having overwritten our typed text back to a blank transition frame).
async function isNearBlank(webpBuf) {
  if (webpBuf.length < MIN_SIZE) return true;
  const { channels } = await sharp(webpBuf).stats();
  return Math.max(...channels.map((c) => c.stdev)) < 8;
}

// skipBlankCheck: the tester path already confirms non-blank-ness on the raw,
// un-padded screenshot before this is ever called — its own "contain"-fit output
// legitimately compresses small (a wide/short strip letterboxed into 640x400 is
// mostly solid padding), which would otherwise trip the size/stdev gates below
// despite having perfectly good content in the un-padded band.
async function validateSpecimen(webpBuf, t, { skipBlankCheck = false } = {}) {
  if (!skipBlankCheck) {
    if (webpBuf.length < MIN_SIZE) return { ok: false, reason: `too small (${webpBuf.length}b)` };

    // Near-solid image (blank page, consent-dimmed overlay, unrendered canvas).
    const { channels } = await sharp(webpBuf).stats();
    const maxStdev = Math.max(...channels.map((c) => c.stdev));
    if (maxStdev < 8) return { ok: false, reason: `near-blank (stdev ${maxStdev.toFixed(1)})` };
  }

  // Identical to another image in this foundry: shared banner, repeated consent wall.
  const hash = createHash("md5").update(webpBuf).digest("hex");
  if (hashesFor(t.foundrySlug).has(hash)) return { ok: false, reason: "duplicate of another specimen in foundry" };

  const client = await getAnthropicClient();
  if (client) {
    try {
      const res = await client.messages.create({
        model: VISION_MODEL,
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/webp", data: webpBuf.toString("base64") } },
            {
              type: "text",
              text:
                `This image was captured from ${t.foundry}'s website for the typeface "${t.name}". ` +
                `Question: can you see real letterforms clearly enough to judge this typeface? ` +
                `Answer no ONLY for: cookie/consent banners or walls, Cloudflare or human-verification ` +
                `pages, error pages (404/500), "coming soon" or parked pages, blank or near-blank ` +
                `captures, language-coverage maps, or images where NO letterforms are visible at all ` +
                `(a bare photo, a logo mark on its own, a diagram, a product shot with no type on it). ` +
                `Answer YES whenever letterforms are legible, even if the shot is not ideal: body text ` +
                `rather than a big display line, marketing copy rather than a pangram, a busy or ` +
                `cropped composition, only one or two words, or a deliberately experimental / ` +
                `distorted typeface showing its genuine character. Composition and copy choice are ` +
                `not the test — legibility is. ` +
                `Reply with JSON only: {"ok": true|false, "reason": "<max 6 words>"}`,
            },
          ],
        }],
      });
      const text = res.content.find((b) => b.type === "text")?.text ?? "";
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      if (parsed.ok !== true) return { ok: false, reason: `vision: ${parsed.reason ?? "rejected"}` };
    } catch (err) {
      // Vision failure never blocks the pipeline — fall back to heuristics-only acceptance.
      console.warn(`vision check failed for ${t.foundrySlug}/${t.slug}: ${err.message}`);
    }
  }

  return { ok: true, hash };
}

function acceptSpecimen(webpBuf, t, hash) {
  hashesFor(t.foundrySlug).add(hash);
  return saveWebp(webpBuf, t);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init = {}, retries = 2) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": UA, Accept: "text/html,image/*,*/*" },
        signal: AbortSignal.timeout(20000),
        ...init,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i >= retries) throw err;
      await sleep(1000 * (i + 1));
    }
  }
}

function extractOgImage(html, pageUrl) {
  const metas = html.match(/<meta[^>]+>/gi) ?? [];
  for (const key of ["og:image", "twitter:image"]) {
    for (const m of metas) {
      if (!new RegExp(`(property|name)=["']${key}(:secure_url)?["']`, "i").test(m)) continue;
      const content = m.match(/content=["']([^"']+)["']/i);
      if (content && content[1]) {
        const raw = content[1].replace(/&amp;/g, "&").trim();
        try {
          return new URL(raw, pageUrl).href;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function dismissCookies(page) {
  // CSS selector pass
  for (const sel of COOKIE_SELECTORS) {
    await page.locator(sel).first().click({ timeout: 400 }).catch(() => {});
  }
  // Marketing/newsletter modal pass — a different overlay class to consent walls,
  // so it gets its own selectors and its own text pattern (close glyphs and
  // dismissal wording rather than accept wording).
  for (const sel of POPUP_SELECTORS) {
    await page.locator(sel).first().click({ timeout: 400 }).catch(() => {});
  }

  // Text-based pass — finds visible buttons whose full text matches either the
  // accept pattern or a close/dismiss pattern. Deliberately does NOT break after
  // the first hit: a page can carry a consent wall and a marketing modal at once,
  // and stopping early leaves whichever one sorts second still covering the page.
  try {
    const buttons = await page.locator("button:visible").all();
    for (const btn of buttons) {
      const text = (await btn.innerText().catch(() => "")).trim();
      if (COOKIE_TEXT_RE.test(text) || POPUP_TEXT_RE.test(text)) {
        await btn.click({ timeout: 400 }).catch(() => {});
      }
    }
  } catch {}
}

// Selectors for known type-tester widgets, most specific first.
// - Fontsampler.js (fontsampler.co) is an open-source tester used by many independent
//   foundries (NaN, and others) — canonical markup is a contenteditable div
//   tagged data-fsjs="tester".
// - Shopify "product variable tester" sections (Pangram Pangram and similar themes)
//   use a contenteditable <p> with this class.
// - "type-tester__line-wrap" (HvD Fonts and likely other foundries on the same
//   platform) wraps a bare contenteditable <span> pre-filled with sample text
//   styled in the real webfont.
// - Generic fallback: any visible contenteditable, or text input/textarea, that
//   looks large enough to be a specimen field rather than a search box or newsletter
//   signup (those are excluded by size and by keyword).
const TESTER_SELECTORS = [
  '[contenteditable="true"][data-fsjs="tester"]',
  ".product-variable-tester__text",
  '.type-tester__line-wrap [contenteditable="true"]',
];
const TESTER_EXCLUDE_RE = /search|newsletter|email|subscribe|comment|login|password/i;

async function findTesterElement(page) {
  for (const sel of TESTER_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.count()) return el;
  }
  // Generic fallback: any contenteditable large enough to be a specimen field.
  const handles = await page.locator('[contenteditable="true"], [contenteditable=""]').all();
  for (const handle of handles) {
    const cls = await handle.getAttribute("class").catch(() => "");
    const id = await handle.getAttribute("id").catch(() => "");
    if (TESTER_EXCLUDE_RE.test(`${cls} ${id}`)) continue;
    const box = await handle.boundingBox().catch(() => null);
    if (box && box.width >= 200 && box.height >= 40) return handle;
  }
  return null;
}

// Two different widget "species" show up in the wild, and need different treatment:
//  - Genuinely contenteditable fields (e.g. Fontsampler.js, used by NaN and others)
//    are real inputs with their own keystroke-driven re-render logic (kerning,
//    per-character measurement). Overwriting textContent via JS renders invisibly —
//    the widget's own JS never sees a real input event and doesn't redraw. These
//    need actual keyboard interaction: select all contents via the Range/Selection
//    API (works across the multi-node/<br> structure a naive triple-click misses),
//    delete, then type.
//  - Non-editable reactive previews (e.g. Shopify "variable tester" text bound via
//    Alpine.js) never resolve isContentEditable to true anywhere in their ancestor
//    chain — they're just plain text nodes styled with font-variation-settings.
//    A direct textContent overwrite is both correct and safe here (whole-node
//    replace, no partial-selection risk), and real keystrokes wouldn't focus them
//    at all.
async function typeIntoTester(page, el, text) {
  const isEditable = await el.evaluate((n) => n.isContentEditable).catch(() => false);
  try {
    if (isEditable) {
      await el.click();
      await el.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
      await page.keyboard.press("Delete");
      await page.keyboard.type(text);
    } else {
      await el.evaluate((node, value) => {
        node.textContent = value;
        node.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      }, text);
    }
    return true;
  } catch {
    return false;
  }
}

// Group work by domain so each domain is hit serially with a delay.
function groupByDomain(typefaces) {
  const groups = new Map();
  for (const t of typefaces) {
    const domain = new URL(t.url).hostname;
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(t);
  }
  return groups;
}

async function runPerDomain(groups, worker) {
  const domains = [...groups.keys()];
  let cursor = 0;
  async function lane() {
    while (cursor < domains.length) {
      const domain = domains[cursor++];
      for (const t of groups.get(domain)) {
        await worker(t);
        await sleep(DOMAIN_DELAY_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DOMAIN_CONCURRENCY, domains.length) }, lane));
}

async function main() {
  const foundryFlag = process.argv.indexOf("--foundry");
  const onlyFoundry = foundryFlag > -1 ? process.argv[foundryFlag + 1] : null;
  const foundriesFlag = process.argv.indexOf("--foundries");
  const onlyFoundries = foundriesFlag > -1 ? new Set(process.argv[foundriesFlag + 1].split(",")) : null;
  const slugsFlag = process.argv.indexOf("--slugs");
  const onlySlugs = slugsFlag > -1 ? new Set(process.argv[slugsFlag + 1].split(",")) : null;
  const force = process.argv.includes("--force");
  const screenshotsOnly = process.argv.includes("--screenshots-only");

  const typefaces = loadTypefaces().filter((t) => {
    if (!t.foundrySlug) {
      console.warn(`SKIP unknown foundry for ${t.name}`);
      return false;
    }
    if (onlyFoundry && t.foundrySlug !== onlyFoundry) return false;
    if (onlyFoundries && !onlyFoundries.has(t.foundrySlug)) return false;
    if (onlySlugs && !onlySlugs.has(t.slug)) return false;
    return true;
  });

  const stats = { pageImg: 0, tester: 0, screenshot: 0, cached: 0, rejected: 0, miss: [] };

  // ---- Browser pass: page-image → og:image → screenshot ----
  // --force re-fetches every entry, but the existing file is only overwritten once a
  // validated replacement is ready (saveWebp writes in place) — never deleted upfront.
  // That way an interrupted run leaves every not-yet-reached font with its old image
  // intact rather than empty.
  const todo = typefaces.filter((t) => {
    if (!force && existsSync(outPath(t))) { stats.cached++; return false; }
    return true;
  });
  console.log(`\nBrowser pass: ${todo.length} pages\n`);

  // Attempts one full capture (page-image, then screenshot with one retry) on an
  // already-navigated page. Returns {ok: true} on save, or {ok: false, reason,
  // botBlocked} so the caller can decide whether a stealth retry is worthwhile.
  async function attemptCapture(page, t) {
    await dismissCookies(page);
    await page.waitForTimeout(800);
    await dismissCookies(page);
    await page.waitForTimeout(800);

    let lastReason = null;

    if (!screenshotsOnly) {
      // 1. Find the largest landscape <img> on the page.
      const imgSrc = await page.evaluate(() => {
        const SKIP = /logo|icon|avatar|placeholder|sprite|flag|badge/i;
        const candidates = [...document.querySelectorAll("img")].map((el) => ({
          src: el.currentSrc || el.src,
          w: el.naturalWidth,
          h: el.naturalHeight,
        })).filter((c) =>
          c.src &&
          !c.src.startsWith("data:") &&
          !/\.svg(\?|$)/i.test(c.src) &&
          !SKIP.test(c.src) &&
          c.w >= 400 &&
          c.h >= 150 &&
          c.w / c.h >= 1.2
        ).sort((a, b) => b.w * b.h - a.w * a.h);
        return candidates[0]?.src ?? null;
      });

      if (imgSrc) {
        try {
          const res = await fetchWithRetry(imgSrc);
          const buf = Buffer.from(await res.arrayBuffer());
          const webp = await processWebp(buf);
          const verdict = await validateSpecimen(webp, t);
          if (verdict.ok) {
            acceptSpecimen(webp, t, verdict.hash);
            stats.pageImg++;
            console.log(`page-image ${t.foundrySlug}/${t.slug} saved`);
            return { ok: true };
          }
          stats.rejected++;
          lastReason = verdict.reason;
          console.log(`page-image rejected ${t.foundrySlug}/${t.slug}: ${verdict.reason} — trying tester`);
        } catch { /* fall through */ }
      }

      // 2. Type the typeface name into the page's own type tester, if one is found,
      // and screenshot just that element — real webfont, our own text, no chrome.
      // Some testers auto-cycle their demo text on a timer as a marketing loop; by
      // the time this pass runs (after the page-image fetch and its vision check
      // have already burned a few real seconds) that cycle may have already fired
      // once, and can fire again during our own wait. So retype immediately before
      // each attempt rather than typing once and hoping the wait outlasts it, and
      // use the cheap local blank-check to retry before paying for a vision call.
      const tester = await findTesterElement(page).catch(() => null);
      if (process.env.DEBUG_TESTER) console.log(`DEBUG tester found=${!!tester} for ${t.foundrySlug}/${t.slug}`);
      if (tester) {
        let testerBuf = null;
        for (let attempt = 0; attempt < 5 && !testerBuf; attempt++) {
          const typed = await typeIntoTester(page, tester, t.name);
          if (!typed) { if (process.env.DEBUG_TESTER) console.log(`DEBUG attempt ${attempt}: typeIntoTester returned false`); break; }
          await page.waitForTimeout(400);
          const buf = await tester.screenshot({ type: "png" }).catch((e) => { if (process.env.DEBUG_TESTER) console.log(`DEBUG attempt ${attempt}: screenshot error: ${e.message}`); return null; });
          if (!buf) break;
          // Check blank-ness on the raw screenshot, not the "contain"-padded output:
          // a wide, short tester strip (e.g. 1141x120) letterboxed into 640x400 ends
          // up mostly padding, which dilutes whole-frame stdev below the blank
          // threshold even when the real (un-padded) text band is fine.
          const blank = await isNearBlank(buf);
          if (process.env.DEBUG_TESTER) console.log(`DEBUG attempt ${attempt}: raw bytes=${buf.length} blank=${blank}`);
          if (!blank) testerBuf = await processWebp(buf, "centre", "contain");
        }
        if (testerBuf) {
          const verdict = await validateSpecimen(testerBuf, t, { skipBlankCheck: true });
          if (verdict.ok) {
            acceptSpecimen(testerBuf, t, verdict.hash);
            stats.tester++;
            console.log(`tester ${t.foundrySlug}/${t.slug} saved`);
            return { ok: true };
          }
          stats.rejected++;
          lastReason = verdict.reason;
          console.log(`tester rejected ${t.foundrySlug}/${t.slug}: ${verdict.reason} — falling back to screenshot`);
        }
      }
    }

    // 3. Screenshot (always runs when --screenshots-only; fallback otherwise).
    // Use position "top" so the hero area fills the frame rather than being cropped from centre.
    // Validated like the page-image; one retry with extra waits, then two scrolled
    // attempts. The scroll pass exists for shops that stack a promo bar, nav and
    // breadcrumb above the fold (RetroSupply is the clearest case — its 13 misses
    // were all "sale popup obscures typeface", which was really just the top of
    // the page being chrome rather than specimen). Scrolling a screenful at a time
    // pushes that chrome out of frame and lands on the actual specimen.
    const SCROLL_STEPS = [0, 0, 700, 1400];
    for (let attempt = 0; attempt < SCROLL_STEPS.length; attempt++) {
      if (attempt === 1) {
        await dismissCookies(page);
        await page.evaluate(() => document.fonts?.ready).catch(() => {});
        await page.waitForTimeout(2500);
      }
      if (SCROLL_STEPS[attempt] > 0) {
        await page.evaluate((y) => window.scrollTo(0, y), SCROLL_STEPS[attempt]).catch(() => {});
        await page.waitForTimeout(600);
      }
      const buf = await page.screenshot({ type: "png" });
      const webp = await processWebp(buf, "top");
      const verdict = await validateSpecimen(webp, t);
      if (verdict.ok) {
        acceptSpecimen(webp, t, verdict.hash);
        stats.screenshot++;
        console.log(`screenshot ${t.foundrySlug}/${t.slug} saved`);
        return { ok: true };
      }
      lastReason = verdict.reason;
    }
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    return { ok: false, reason: lastReason, botBlocked: BOT_BLOCK_RE.test(lastReason ?? "") };
  }

  // Stealth browser is launched lazily, once, only if a bot-block is actually hit.
  let stealthBrowser = null;
  let stealthContext = null;
  async function getStealthContext() {
    if (!stealthContext) {
      stealthBrowser = await stealthChromium.launch({ headless: true });
      stealthContext = await stealthBrowser.newContext({
        viewport: { width: 1280, height: 960 },
        userAgent: UA,
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "Europe/London",
      });
    }
    return stealthContext;
  }

  if (todo.length > 0) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      userAgent: UA,
      deviceScaleFactor: 1,
    });

    await runPerDomain(groupByDomain(todo), async (t) => {
      const page = await context.newPage();
      let result;
      try {
        await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        result = await attemptCapture(page, t);
      } catch (err) {
        result = { ok: false, reason: err.message, botBlocked: false };
      } finally {
        await page.close();
      }

      if (!result.ok && result.botBlocked) {
        console.log(`${t.foundrySlug}/${t.slug}: bot-block detected, retrying with stealth`);
        const stealthPage = await (await getStealthContext()).newPage();
        try {
          await stealthPage.goto(t.url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await stealthPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          result = await attemptCapture(stealthPage, t);
        } catch (err) {
          result = { ok: false, reason: err.message, botBlocked: false };
        } finally {
          await stealthPage.close();
        }
      }

      if (!result.ok) {
        stats.rejected++;
        stats.miss.push(`${t.foundrySlug}/${t.slug}`);
        console.warn(`FAIL ${t.foundrySlug}/${t.slug}: ${result.reason ?? "unknown"} — recorded as miss`);
      }
    });

    await browser.close();
    if (stealthBrowser) await stealthBrowser.close();
  }

  // ---- Manifest ----
  // Merge with existing manifest so --foundry runs don't wipe other entries.
  const existing = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const manifest = { ...existing };
  for (const t of typefaces) {
    manifest[`${t.foundrySlug}/${t.slug}`] = existsSync(outPath(t));
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0) + "\n");

  console.log(
    `\nDone. page-image ${stats.pageImg}, tester ${stats.tester}, screenshots ${stats.screenshot}, cached ${stats.cached}, ` +
      `rejected ${stats.rejected}, misses ${stats.miss.length}, manifest entries ${Object.keys(manifest).length}/${typefaces.length}`
  );
  if (stats.miss.length) console.log("Missed:", stats.miss.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

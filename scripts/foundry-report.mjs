#!/usr/bin/env node
// foundry-report.mjs — shows indexed / blocked / unprobed status for all foundries
// Usage: node scripts/foundry-report.mjs [--tier best|okay|loose|notgood]

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const { foundries } = JSON.parse(readFileSync(join(root, "data", "foundries.json"), "utf8"));

const foundryMapSrc = readFileSync(join(root, "lib", "foundry-map.ts"), "utf8");

// Parse FOUNDRIES array: extract { homepage, slug } pairs
const indexedMap = new Map(); // domain → slug
for (const m of foundryMapSrc.matchAll(/\{\s*name:[^}]+slug:\s*"([^"]+)"[^}]+homepage:\s*"([^"]+)"/gs)) {
  const slug = m[1];
  const homepage = m[2];
  const domain = homepage.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
  indexedMap.set(domain, slug);
}

// Parse BLOCKED_FOUNDRIES: domain → reason
const blockedMap = new Map();
for (const m of foundryMapSrc.matchAll(/\{\s*domain:\s*"([^"]+)"[^}]+reason:\s*"([^"]+)"/gs)) {
  blockedMap.set(m[1], m[2]);
}

// Typeface counts per slug
const typefaceCounts = new Map();
for (const file of readdirSync(join(root, "data")).filter(f => f.startsWith("typefaces-") && f.endsWith(".json"))) {
  const slug = file.replace("typefaces-", "").replace(".json", "");
  const data = JSON.parse(readFileSync(join(root, "data", file), "utf8"));
  typefaceCounts.set(slug, data.length);
}

function normaliseDomain(url) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
}

const tierFilter = process.argv.includes("--tier")
  ? process.argv[process.argv.indexOf("--tier") + 1]
  : null;

const indexed = [];
const blocked = [];
const unprobed = [];

for (const f of foundries) {
  if (tierFilter && f.tier !== tierFilter) continue;
  const domain = normaliseDomain(f.url);

  if (indexedMap.has(domain)) {
    const slug = indexedMap.get(domain);
    indexed.push({ name: f.name, domain, tier: f.tier, count: typefaceCounts.get(slug) ?? "?" });
  } else if (blockedMap.has(f.domain)) {
    blocked.push({ name: f.name, domain: f.domain, tier: f.tier, reason: blockedMap.get(f.domain) });
  } else {
    unprobed.push({ name: f.name, domain: f.domain, tier: f.tier });
  }
}

const TIER_ORDER = { best: 0, good: 1, okay: 2, loose: 3, notgood: 4 };
const byTier = (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier];

const hr = "─".repeat(72);
console.log(`\n${hr}`);
console.log(`  FOUNDRY STATUS REPORT  (${foundries.length} total${tierFilter ? ` · tier: ${tierFilter}` : ""})`);
console.log(`${hr}\n`);

console.log(`✅  INDEXED (${indexed.length})`);
indexed.sort(byTier).forEach(f => {
  const count = String(f.count).padStart(4);
  console.log(`  [${f.tier.padEnd(7)}]  ${f.name.padEnd(40)} ${count} typefaces`);
});

console.log(`\n🚫  BLOCKED (${blocked.length})`);
blocked.sort(byTier).forEach(f => {
  console.log(`  [${f.tier.padEnd(7)}]  ${f.name.padEnd(40)} ${f.reason}`);
});

console.log(`\n⬜  UNPROBED (${unprobed.length})`);
unprobed.sort(byTier).forEach(f => {
  console.log(`  [${f.tier.padEnd(7)}]  ${f.name.padEnd(40)} ${f.domain}`);
});

const totalTypefaces = indexed.reduce((sum, f) => sum + (typeof f.count === "number" ? f.count : 0), 0);
console.log(`\n${hr}`);
console.log(`  ${indexed.length} indexed · ${blocked.length} blocked · ${unprobed.length} unprobed · ${totalTypefaces} typefaces total`);
console.log(`${hr}\n`);

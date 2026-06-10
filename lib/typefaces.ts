import atipo from "@/data/typefaces-atipo.json";
import commercialType from "@/data/typefaces-commercial-type.json";
import daltonMaag from "@/data/typefaces-dalton-maag.json";
import dinamo from "@/data/typefaces-dinamo.json";
import displaay from "@/data/typefaces-displaay.json";
import f37 from "@/data/typefaces-f37.json";
import grilli from "@/data/typefaces-grilli.json";
import hoefler from "@/data/typefaces-hoefler.json";
import klim from "@/data/typefaces-klim.json";
import optimo from "@/data/typefaces-optimo.json";
import pangram from "@/data/typefaces-pangram-pangram.json";
import schickToikka from "@/data/typefaces-schick-toikka.json";
import sociotype from "@/data/typefaces-sociotype.json";

import { FOUNDRIES, getFoundryByName, type FoundryInfo } from "./foundry-map";

export const CATEGORIES = [
  "serif",
  "sans-serif",
  "slab",
  "display",
  "mono",
  "script",
  "blackletter",
] as const;

export type Category = (typeof CATEGORIES)[number];

// The schema says "loose" but the data says "good"; the data wins.
export const TIERS = ["best", "good", "okay", "notgood"] as const;

export type Tier = (typeof TIERS)[number];

export type Typeface = {
  name: string;
  foundry: string;
  url: string;
  designer: string | null;
  year: number | null;
  category: Category;
  subcategory: string;
  classification_notes: string;
  weights: string[];
  optical_sizes_or_widths: string[];
  subfamilies: string[];
  has_condensed: boolean;
  has_italic: boolean;
  has_mono: boolean;
  languages: string[];
  tier: Tier;
  type: "foundry" | "reseller" | "free";
  tags: string[];
  summary: string;
  description: string;
  foundry_blurb: string;
  // derived
  slug: string;
  foundrySlug: string;
};

// A few files stray from the canonical seven categories.
const CATEGORY_ALIASES: Record<string, Category> = {
  monospace: "mono",
  "slab serif": "slab",
  "slab-serif": "slab",
  hand: "script",
  symbol: "display",
};

export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type RawTypeface = Omit<Typeface, "category" | "tier" | "slug" | "foundrySlug"> & {
  category: string;
  tier: string;
};

function normalise(raw: RawTypeface): Typeface {
  const category = (CATEGORY_ALIASES[raw.category] ?? raw.category) as Category;
  const foundry = getFoundryByName(raw.foundry);
  return {
    ...raw,
    category,
    tier: raw.tier as Tier,
    slug: slugify(raw.name),
    foundrySlug: foundry?.slug ?? slugify(raw.foundry),
  };
}

let cache: Typeface[] | null = null;

export function getAllTypefaces(): Typeface[] {
  if (!cache) {
    cache = (
      [
        atipo,
        commercialType,
        daltonMaag,
        dinamo,
        displaay,
        f37,
        grilli,
        hoefler,
        klim,
        optimo,
        pangram,
        schickToikka,
        sociotype,
      ] as RawTypeface[][]
    )
      .flat()
      .map(normalise);
  }
  return cache;
}

// Subset shipped to the client for the directory grid. Keeps the payload
// small and keeps foundry_blurb out of public HTML.
export type DirectoryEntry = Pick<
  Typeface,
  | "name"
  | "foundry"
  | "foundrySlug"
  | "slug"
  | "year"
  | "category"
  | "tags"
  | "designer"
  | "summary"
  | "tier"
  | "has_condensed"
  | "has_italic"
  | "has_mono"
>;

export function toDirectoryEntry(t: Typeface): DirectoryEntry {
  return {
    name: t.name,
    foundry: t.foundry,
    foundrySlug: t.foundrySlug,
    slug: t.slug,
    year: t.year,
    category: t.category,
    tags: t.tags,
    designer: t.designer,
    summary: t.summary,
    tier: t.tier,
    has_condensed: t.has_condensed,
    has_italic: t.has_italic,
    has_mono: t.has_mono,
  };
}

export function getTypefaceByFoundryAndSlug(
  foundrySlug: string,
  typefaceSlug: string
): Typeface | undefined {
  return getAllTypefaces().find(
    (t) => t.foundrySlug === foundrySlug && t.slug === typefaceSlug
  );
}

export function getTypefacesByFoundrySlug(foundrySlug: string): Typeface[] {
  return getAllTypefaces().filter((t) => t.foundrySlug === foundrySlug);
}

export function getFoundries(): FoundryInfo[] {
  return FOUNDRIES;
}

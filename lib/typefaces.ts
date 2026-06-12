import aFoundry from "@/data/typefaces-a-foundry.json";
import aTypeOfAmigo from "@/data/typefaces-a-type-of-amigo.json";
import a2Type from "@/data/typefaces-a2-type.json";
import allcaps from "@/data/typefaces-allcaps.json";
import almarena from "@/data/typefaces-almarena.json";
import arillatype from "@/data/typefaces-arillatype.json";
import atipo from "@/data/typefaces-atipo.json";
import baltoTypeSupply from "@/data/typefaces-balto-type-supply.json";
import bastarda from "@/data/typefaces-bastarda.json";
import bigFogFoundry from "@/data/typefaces-big-fog-foundry.json";
import binnenland from "@/data/typefaces-binnenland.json";
import blazeType from "@/data/typefaces-blaze-type.json";
import britishStandardType from "@/data/typefaces-british-standard-type.json";
import bureauBrut from "@/data/typefaces-bureau-brut.json";
import camelot from "@/data/typefaces-camelot.json";
import cast from "@/data/typefaces-cast.json";
import catalogue from "@/data/typefaces-catalogue.json";
import coltType from "@/data/typefaces-colt-type.json";
import commercialType from "@/data/typefaces-commercial-type.json";
import coppersAndBrasses from "@/data/typefaces-coppers-and-brasses.json";
import daltonMaag from "@/data/typefaces-dalton-maag.json";
import dardenStudio from "@/data/typefaces-darden-studio.json";
import dharmaType from "@/data/typefaces-dharma-type.json";
import dinamo from "@/data/typefaces-dinamo.json";
import displaay from "@/data/typefaces-displaay.json";
import dueStudio from "@/data/typefaces-due-studio.json";
import extraset from "@/data/typefaces-extraset.json";
import f37 from "@/data/typefaces-f37.json";
import faireType from "@/data/typefaces-faire-type.json";
import fatype from "@/data/typefaces-fatype.json";
import fontwerk from "@/data/typefaces-fontwerk.json";
import frost from "@/data/typefaces-frost.json";
import generalTypeStudio from "@/data/typefaces-general-type-studio.json";
import gradient from "@/data/typefaces-gradient.json";
import grilli from "@/data/typefaces-grilli.json";
import grotesklyYours from "@/data/typefaces-groteskly-yours.json";
import hoefler from "@/data/typefaces-hoefler.json";
import intervalType from "@/data/typefaces-interval-type.json";
import kilotype from "@/data/typefaces-kilotype.json";
import klim from "@/data/typefaces-klim.json";
import kometaTypefaces from "@/data/typefaces-kometa-typefaces.json";
import kurppaHoskType from "@/data/typefaces-kurppa-hosk-type.json";
import leinsterType from "@/data/typefaces-leinster-type.json";
import lettersFromSweden from "@/data/typefaces-letters-from-sweden.json";
import lineto from "@/data/typefaces-lineto.json";
import nan from "@/data/typefaces-nan.json";
import newlyn from "@/data/typefaces-newlyn.json";
import ohNoType from "@/data/typefaces-oh-no-type.json";
import optimo from "@/data/typefaces-optimo.json";
import pangram from "@/data/typefaces-pangram-pangram.json";
import playtype from "@/data/typefaces-playtype.json";
import prioritype from "@/data/typefaces-prioritype.json";
import productionType from "@/data/typefaces-production-type.json";
import schickToikka from "@/data/typefaces-schick-toikka.json";
import signal from "@/data/typefaces-signal.json";
import sociotype from "@/data/typefaces-sociotype.json";
import studioReneBieder from "@/data/typefaces-studio-rene-bieder.json";
import swissTypefaces from "@/data/typefaces-swiss-typefaces.json";
import taylorPenton from "@/data/typefaces-taylor-penton.json";
import theDesignersFoundry from "@/data/typefaces-the-designers-foundry.json";
import typespec from "@/data/typefaces-typespec.json";
import typotheque from "@/data/typefaces-typotheque.json";
import vjType from "@/data/typefaces-vj-type.json";
import xyzType from "@/data/typefaces-xyz-type.json";

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
        aFoundry,
        aTypeOfAmigo,
        a2Type,
        allcaps,
        almarena,
        arillatype,
        atipo,
        baltoTypeSupply,
        bastarda,
        bigFogFoundry,
        binnenland,
        blazeType,
        britishStandardType,
        bureauBrut,
        camelot,
        cast,
        catalogue,
        coltType,
        commercialType,
        coppersAndBrasses,
        daltonMaag,
        dardenStudio,
        dharmaType,
        dinamo,
        displaay,
        dueStudio,
        extraset,
        f37,
        faireType,
        fatype,
        fontwerk,
        frost,
        generalTypeStudio,
        gradient,
        grilli,
        grotesklyYours,
        hoefler,
        intervalType,
        kilotype,
        klim,
        kometaTypefaces,
        kurppaHoskType,
        leinsterType,
        lettersFromSweden,
        lineto,
        nan,
        newlyn,
        ohNoType,
        optimo,
        pangram,
        playtype,
        prioritype,
        productionType,
        schickToikka,
        signal,
        sociotype,
        studioReneBieder,
        swissTypefaces,
        taylorPenton,
        theDesignersFoundry,
        typespec,
        typotheque,
        vjType,
        xyzType,
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
  | "url"
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
    url: t.url,
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

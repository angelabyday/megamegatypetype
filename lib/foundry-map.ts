// Foundry names in the typeface files don't match the bookmark titles in
// data/foundries.json ("Klim Type Foundry" vs "Klim Type Foundry - Home"),
// so homepage URLs and tiers are pinned here for the 13 indexed foundries.

export type FoundryInfo = {
  name: string; // as it appears in the typeface files
  slug: string;
  homepage: string;
  tier: "best" | "good" | "okay" | "notgood";
};

export const FOUNDRIES: FoundryInfo[] = [
  { name: "atipo foundry", slug: "atipo-foundry", homepage: "https://www.atipofoundry.com/", tier: "best" },
  { name: "Commercial Type", slug: "commercial-type", homepage: "https://commercialtype.com/", tier: "okay" },
  { name: "Dalton Maag", slug: "dalton-maag", homepage: "https://www.daltonmaag.com/", tier: "best" },
  { name: "Dinamo Typefaces", slug: "dinamo-typefaces", homepage: "https://abcdinamo.com/", tier: "best" },
  { name: "Displaay Type Foundry", slug: "displaay-type-foundry", homepage: "https://displaay.net/", tier: "best" },
  { name: "F37 Foundry", slug: "f37-foundry", homepage: "https://www.f37foundry.com/", tier: "okay" },
  { name: "Grilli Type", slug: "grilli-type", homepage: "https://www.grillitype.com/", tier: "best" },
  { name: "Hoefler & Co", slug: "hoefler-co", homepage: "https://www.typography.com/", tier: "notgood" },
  { name: "Klim Type Foundry", slug: "klim-type-foundry", homepage: "https://klim.co.nz/", tier: "best" },
  { name: "Optimo", slug: "optimo", homepage: "https://optimo.ch/", tier: "best" },
  { name: "Pangram Pangram Foundry", slug: "pangram-pangram-foundry", homepage: "https://pangrampangram.com/", tier: "best" },
  { name: "Schick Toikka", slug: "schick-toikka", homepage: "https://www.schick-toikka.com/", tier: "best" },
  { name: "Sociotype", slug: "sociotype", homepage: "https://socio-type.com/", tier: "best" },
];

export function getFoundryBySlug(slug: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.slug === slug);
}

export function getFoundryByName(name: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.name === name);
}

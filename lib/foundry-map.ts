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
  { name: "Lineto", slug: "lineto", homepage: "https://lineto.com/", tier: "best" },
  { name: "Swiss Typefaces", slug: "swiss-typefaces", homepage: "https://www.swisstypefaces.com/", tier: "best" },
  { name: "Production Type", slug: "production-type", homepage: "https://www.productiontype.com/", tier: "best" },
  { name: "Newlyn", slug: "newlyn", homepage: "https://newlyn.com/", tier: "best" },
  { name: "Typotheque", slug: "typotheque", homepage: "https://www.typotheque.com/", tier: "best" },
  { name: "OH no Type", slug: "oh-no-type", homepage: "https://ohnotype.co/", tier: "best" },
  { name: "Fontwerk", slug: "fontwerk", homepage: "https://fontwerk.com/", tier: "best" },
  { name: "CAST", slug: "cast", homepage: "https://www.c-a-s-t.com/", tier: "best" },
  { name: "Camelot", slug: "camelot", homepage: "https://camelot-typefaces.com/", tier: "best" },
  { name: "Extraset", slug: "extraset", homepage: "https://extraset.ch/", tier: "best" },
  { name: "Fatype", slug: "fatype", homepage: "https://fatype.com/", tier: "best" },
  { name: "NaN", slug: "nan", homepage: "https://www.nan.xyz/", tier: "best" },
  { name: "Signal", slug: "signal", homepage: "https://signalfoundry.com/", tier: "best" },
  { name: "Blaze Type", slug: "blaze-type", homepage: "https://blazetype.eu/", tier: "best" },
  { name: "a.Foundry", slug: "a-foundry", homepage: "https://a-foundry.com/", tier: "best" },
  { name: "AllCaps", slug: "allcaps", homepage: "https://www.allcapstype.com/", tier: "best" },
  { name: "Arillatype", slug: "arillatype", homepage: "https://arillatype.studio/", tier: "best" },
  { name: "Faire Type", slug: "faire-type", homepage: "https://www.fairetype.com/", tier: "best" },
  { name: "British Standard Type", slug: "british-standard-type", homepage: "https://www.britishstandardtype.xyz/", tier: "best" },
  { name: "OTT Foundry", slug: "ott-foundry", homepage: "https://ott-foundry.com/", tier: "best" },
  { name: "Bureau Brut", slug: "bureau-brut", homepage: "https://bureaubrut.com/", tier: "best" },
  { name: "A Type of Amigo", slug: "a-type-of-amigo", homepage: "https://atypeofamigo.com/", tier: "best" },
  { name: "Bastarda", slug: "bastarda", homepage: "https://bastardatype.com/", tier: "best" },
  { name: "Interval Type", slug: "interval-type", homepage: "https://intervaltype.com/", tier: "best" },
  { name: "Due Studio", slug: "due-studio", homepage: "https://www.due-studio.com/", tier: "best" },
  { name: "Typespec", slug: "typespec", homepage: "https://typespec.co.uk/", tier: "best" },
];

export function getFoundryBySlug(slug: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.slug === slug);
}

export function getFoundryByName(name: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.name === name);
}

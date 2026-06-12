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
  { name: "Almarena", slug: "almarena", homepage: "https://almarenafoundry.com/", tier: "best" },
  { name: "A2-Type", slug: "a2-type", homepage: "https://a2-type.co.uk/", tier: "best" },
  { name: "Binnenland", slug: "binnenland", homepage: "https://www.binnenland.ch/", tier: "best" },
  { name: "Catalogue (Florian Karsten)", slug: "catalogue", homepage: "https://fonts.floriankarsten.com/", tier: "best" },
  { name: "Frost", slug: "frost", homepage: "https://frostype.xyz/", tier: "best" },
  { name: "Groteskly Yours", slug: "groteskly-yours", homepage: "https://groteskly.xyz/", tier: "best" },
  { name: "General Type Studio", slug: "general-type-studio", homepage: "https://www.generaltypestudio.com/", tier: "best" },
  { name: "Leinster Type", slug: "leinster-type", homepage: "https://www.leinstertype.com/", tier: "best" },
  { name: "Playtype", slug: "playtype", homepage: "https://playtype.com/", tier: "best" },
  { name: "Studio Rene Bieder", slug: "studio-rene-bieder", homepage: "https://www.renebieder.com/", tier: "best" },
  { name: "TIGHTYPE", slug: "tightype", homepage: "https://tightype.com/", tier: "best" },
  { name: "The Designers Foundry", slug: "the-designers-foundry", homepage: "https://thedesignersfoundry.com/", tier: "best" },
  { name: "Prioritype", slug: "prioritype", homepage: "https://prioritypeco.com/", tier: "best" },
  { name: "Taylor Penton", slug: "taylor-penton", homepage: "https://www.taylorpenton.com/", tier: "best" },
  { name: "VJ Type", slug: "vj-type", homepage: "https://vj-type.com/", tier: "best" },
  { name: "Balto / Type Supply", slug: "balto-type-supply", homepage: "https://typesupply.com/", tier: "okay" },
  { name: "Big Fog Foundry", slug: "big-fog-foundry", homepage: "https://foundry.bigfog.co/", tier: "okay" },
  { name: "Coppers and Brasses", slug: "coppers-and-brasses", homepage: "https://coppersandbrasses.com/", tier: "okay" },
  { name: "Darden Studio", slug: "darden-studio", homepage: "https://www.dardenstudio.com/", tier: "okay" },
  { name: "Colt Type", slug: "colt-type", homepage: "https://wearecolt.com/", tier: "okay" },
  { name: "Dharma Type", slug: "dharma-type", homepage: "https://dharmatype.com/", tier: "okay" },
  { name: "XYZ Type", slug: "xyz-type", homepage: "https://xyztype.com/", tier: "okay" },
  { name: "Kilotype", slug: "kilotype", homepage: "https://kilotype.de/", tier: "okay" },
  { name: "KOMETA Typefaces", slug: "kometa-typefaces", homepage: "https://www.kometa.xyz/", tier: "okay" },
  { name: "Kurppa Hosk Type", slug: "kurppa-hosk-type", homepage: "https://khtype.com/", tier: "okay" },
  { name: "Gradient", slug: "gradient", homepage: "https://wearegradient.net/", tier: "okay" },
  { name: "Letters from Sweden", slug: "letters-from-sweden", homepage: "https://lettersfromsweden.se/", tier: "okay" },
];

export function getFoundryBySlug(slug: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.slug === slug);
}

export function getFoundryByName(name: string): FoundryInfo | undefined {
  return FOUNDRIES.find((f) => f.name === name);
}

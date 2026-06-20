import type { Metadata } from "next";
import { FOUNDRIES } from "@/lib/foundry-map";
import { getAllTypefaces } from "@/lib/typefaces";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FoundriesToggle } from "@/components/foundries-toggle";

export const metadata: Metadata = {
  title: "Foundries",
  description: "All independent type foundries in the MegaMegaTypeType directory.",
};

export default function FoundriesPage() {
  const typefaces = getAllTypefaces();
  const countByFoundry = typefaces.reduce<Record<string, number>>((acc, t) => {
    acc[t.foundrySlug] = (acc[t.foundrySlug] ?? 0) + 1;
    return acc;
  }, {});

  const sorted = [...FOUNDRIES]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({
      slug: f.slug,
      name: f.name,
      homepage: f.homepage,
      hasImage: existsSync(join(process.cwd(), "public", "foundry-images", `${f.slug}.webp`)),
      count: countByFoundry[f.slug] ?? 0,
    }));

  const indexed = sorted.filter((f) => f.count > 0);
  const notIndexed = sorted.filter((f) => f.count === 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Foundries</h1>
      <p className="mt-1 text-muted-foreground">
        {sorted.length} foundries in the directory
      </p>
      <FoundriesToggle indexed={indexed} notIndexed={notIndexed} />
    </div>
  );
}

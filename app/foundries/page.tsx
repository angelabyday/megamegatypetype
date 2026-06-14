import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FOUNDRIES } from "@/lib/foundry-map";
import { getAllTypefaces } from "@/lib/typefaces";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

  const sorted = [...FOUNDRIES].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Foundries</h1>
      <p className="mt-1 text-muted-foreground">
        {sorted.length} foundries in the directory
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {sorted.map((foundry) => {
          const hasImage = existsSync(
            join(process.cwd(), "public", "foundry-images", `${foundry.slug}.webp`)
          );
          const count = countByFoundry[foundry.slug] ?? 0;
          return (
            <Link
              key={foundry.slug}
              href={`/foundry/${foundry.slug}`}
              className="group relative overflow-hidden rounded-[12px] border-[0.5px] border-border hover:border-foreground/30 transition-colors"
            >
              {hasImage ? (
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                  <Image
                    src={`/foundry-images/${foundry.slug}.webp`}
                    alt={foundry.name}
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">{new URL(foundry.homepage).hostname.replace(/^www\./, "")}</span>
                </div>
              )}
              <div className="p-3">
                <div className="font-semibold text-sm leading-tight">{foundry.name}</div>
                {count > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {count} {count === 1 ? "typeface" : "typefaces"}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

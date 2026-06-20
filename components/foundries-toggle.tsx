"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type FoundryEntry = {
  slug: string;
  name: string;
  homepage: string;
  hasImage: boolean;
  firstSpecimen: string | null;
  count: number;
};

function FoundryGrid({ foundries }: { foundries: FoundryEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {foundries.map((foundry) => {
        const imageSrc = foundry.hasImage
          ? `/foundry-images/${foundry.slug}.webp`
          : foundry.firstSpecimen
          ? `/specimens/${foundry.slug}/${foundry.firstSpecimen}.webp`
          : null;
        return (
        <Link
          key={foundry.slug}
          href={`/foundry/${foundry.slug}`}
          className="group relative overflow-hidden rounded-[12px] border-[0.5px] border-border hover:border-foreground/30 transition-colors"
        >
          {imageSrc ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
              <Image
                src={imageSrc}
                alt={foundry.name}
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[16/10] w-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-xs">
                {new URL(foundry.homepage).hostname.replace(/^www\./, "")}
              </span>
            </div>
          )}
          <div className="p-3">
            <div className="font-semibold text-sm leading-tight">{foundry.name}</div>
            {foundry.count > 0 && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {foundry.count} {foundry.count === 1 ? "typeface" : "typefaces"}
              </div>
            )}
          </div>
        </Link>
        );
      })}
    </div>
  );
}

export function FoundriesToggle({
  indexed,
  notIndexed,
}: {
  indexed: FoundryEntry[];
  notIndexed: FoundryEntry[];
}) {
  const [tab, setTab] = useState<"indexed" | "not-indexed">("indexed");

  return (
    <div>
      <div className="mt-6 flex gap-1 rounded-full bg-muted p-1 w-fit">
        <button
          onClick={() => setTab("indexed")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "indexed"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Indexed <span className="ml-1 opacity-60">{indexed.length}</span>
        </button>
        <button
          onClick={() => setTab("not-indexed")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "not-indexed"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Not yet indexed <span className="ml-1 opacity-60">{notIndexed.length}</span>
        </button>
      </div>

      <div className="mt-6">
        <FoundryGrid foundries={tab === "indexed" ? indexed : notIndexed} />
      </div>
    </div>
  );
}

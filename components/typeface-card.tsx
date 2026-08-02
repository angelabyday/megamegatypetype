import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CompareButton } from "@/components/compare-button";
import { LikeButton } from "@/components/like-button";
import { FolderButton } from "@/components/folder-button";
import specimens from "@/lib/specimens.json";
import type { DirectoryEntry } from "@/lib/typefaces";
import type { CardSize } from "@/components/favourites/liked-grid";

export function hasSpecimen(foundrySlug: string, slug: string): boolean {
  return Boolean((specimens as Record<string, boolean>)[`${foundrySlug}/${slug}`]);
}

export function TypefaceCard({ typeface, priority, size = "md" }: { typeface: DirectoryEntry; priority?: boolean; size?: CardSize }) {
  const specimen = hasSpecimen(typeface.foundrySlug, typeface.slug);
  const detailUrl = `/t/${typeface.foundrySlug}/${typeface.slug}`;

  const compareItem = {
    foundrySlug: typeface.foundrySlug,
    slug: typeface.slug,
    name: typeface.name,
    foundry: typeface.foundry,
    hasSpecimen: specimen,
  };

  const pad = size === "xs" ? "p-2" : size === "sm" ? "p-3" : size === "lg" ? "p-5" : "p-4";
  const nameSize = size === "xs" || size === "sm" ? "text-xs font-bold" : size === "lg" ? "text-lg font-bold" : "font-bold";
  const metaSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="relative group border-[0.5px] border-border overflow-hidden rounded-[12px]">
      {/* Top-right button cluster: compare, like, folder+ */}
      <CompareButton item={compareItem} />
      <LikeButton
        foundrySlug={typeface.foundrySlug}
        typefaceSlug={typeface.slug}
        className="absolute top-2 right-10 z-10"
      />
      <FolderButton
        foundrySlug={typeface.foundrySlug}
        typefaceSlug={typeface.slug}
        className="absolute top-2 right-[4.5rem] z-10"
      />

      <Link
        href={detailUrl}
        className="block transition-colors hover:bg-muted/50"
      >
        {specimen && (
          <div className={`relative aspect-[16/10] w-full overflow-hidden rounded-b-[12px] border-b-[0.5px] border-border ${typeface.foundrySlug === "catalogue" ? "bg-black" : "bg-muted"}`}>
            <Image
              src={`/specimens/${typeface.foundrySlug}/${typeface.slug}.webp`}
              alt={`${typeface.name} specimen from ${typeface.foundry}`}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
              priority={priority}
            />
          </div>
        )}
        <div className={pad}>
          <div className="flex items-start justify-between gap-2">
            <span className={nameSize}>{typeface.name}</span>
            <Badge className="shrink-0 rounded-full bg-foreground text-background hover:bg-foreground">
              {typeface.category}
            </Badge>
          </div>
          {size !== "xs" && (
            <div className={`mt-0.5 ${metaSize} text-muted-foreground`}>
              {typeface.foundry}
              {typeface.year ? ` · ${typeface.year}` : ""}
            </div>
          )}
          {size !== "xs" && size !== "sm" && typeface.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {typeface.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border-[0.5px] border-border px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Action bar – slides up from below on hover */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex items-stretch border-t-[0.5px] border-border rounded-b-[12px] overflow-hidden">
        <Link
          href={detailUrl}
          className="flex-1 py-3 text-xs font-medium text-center border-r-[0.5px] border-border bg-foreground text-background hover:opacity-80 transition-opacity"
        >
          Font info
        </Link>
        <a
          href={typeface.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 text-xs font-medium text-center bg-foreground text-background hover:opacity-80 transition-opacity"
        >
          Get the font
        </a>
      </div>
    </div>
  );
}

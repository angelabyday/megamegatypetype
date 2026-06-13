import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import specimens from "@/lib/specimens.json";
import type { DirectoryEntry } from "@/lib/typefaces";
export function hasSpecimen(foundrySlug: string, slug: string): boolean {
  return Boolean((specimens as Record<string, boolean>)[`${foundrySlug}/${slug}`]);
}

export function TypefaceCard({ typeface, priority }: { typeface: DirectoryEntry; priority?: boolean }) {
  const specimen = hasSpecimen(typeface.foundrySlug, typeface.slug);
  const detailUrl = `/t/${typeface.foundrySlug}/${typeface.slug}`;

  return (
    <div className="relative group border-[0.5px] border-border overflow-hidden rounded-[12px]">
      <Link
        href={detailUrl}
        className="block transition-colors hover:bg-muted/50"
      >
        {specimen && (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-b-[12px] border-b-[0.5px] border-border bg-muted">
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
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold">{typeface.name}</span>
            <Badge className="shrink-0 rounded-full bg-foreground text-background hover:bg-foreground">
              {typeface.category}
            </Badge>
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            {typeface.foundry}
            {typeface.year ? ` · ${typeface.year}` : ""}
          </div>
          {typeface.tags.length > 0 && (
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
      <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex border-t-[0.5px] border-border bg-background rounded-b-[12px]">
        <Link
          href={detailUrl}
          className="flex-1 py-3 text-xs font-medium text-center border-r-[0.5px] border-border hover:bg-muted transition-colors"
        >
          Font info
        </Link>
        <a
          href={typeface.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-3 text-xs font-medium text-center hover:bg-muted transition-colors"
        >
          Get the font
        </a>
      </div>
    </div>
  );
}

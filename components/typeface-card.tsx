import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import specimens from "@/lib/specimens.json";
import type { DirectoryEntry } from "@/lib/typefaces";

export function hasSpecimen(foundrySlug: string, slug: string): boolean {
  return Boolean((specimens as Record<string, boolean>)[`${foundrySlug}/${slug}`]);
}

export function TypefaceCard({ typeface }: { typeface: DirectoryEntry }) {
  const specimen = hasSpecimen(typeface.foundrySlug, typeface.slug);

  return (
    <Link
      href={`/t/${typeface.foundrySlug}/${typeface.slug}`}
      className="block border-[0.5px] border-border transition-colors hover:bg-muted/50"
    >
      {specimen && (
        <div className="relative aspect-[16/10] w-full overflow-hidden border-b-[0.5px] border-border bg-muted">
          <Image
            src={`/specimens/${typeface.foundrySlug}/${typeface.slug}.webp`}
            alt={`${typeface.name} specimen from ${typeface.foundry}`}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold">{typeface.name}</span>
          <Badge variant="outline" className="shrink-0">
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
                className="border-[0.5px] border-border px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

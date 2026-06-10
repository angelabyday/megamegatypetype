import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DirectoryEntry } from "@/lib/typefaces";

export function TypefaceCard({ typeface }: { typeface: DirectoryEntry }) {
  return (
    <Link
      href={`/t/${typeface.foundrySlug}/${typeface.slug}`}
      className="block border-[0.5px] border-border p-4 transition-colors hover:bg-muted/50"
    >
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
    </Link>
  );
}

"use client";

import { Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare, type CompareItem } from "@/contexts/compare-context";

export function CompareButton({ item }: { item: CompareItem }) {
  const { toggle, isInCompare } = useCompare();
  const active = isInCompare(item.foundrySlug, item.slug);

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(item); }}
      aria-label={active ? "Remove from compare" : "Add to compare"}
      className={cn(
        "absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all",
        active
          ? "bg-foreground text-background opacity-100"
          : "bg-background/80 text-foreground opacity-0 group-hover:opacity-100"
      )}
    >
      <Columns2 className="h-3.5 w-3.5" />
    </button>
  );
}

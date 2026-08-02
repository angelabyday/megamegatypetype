"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TypefaceCard } from "@/components/typeface-card";
import type { DirectoryEntry } from "@/lib/typefaces";

function SortableLikedCard({ typeface, size }: { typeface: DirectoryEntry; size?: CardSize }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `L:${typeface.foundrySlug}/${typeface.slug}`,
    data: { type: "liked", foundrySlug: typeface.foundrySlug, typefaceSlug: typeface.slug },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className="touch-none"
      {...listeners}
      {...attributes}
    >
      <TypefaceCard typeface={typeface} size={size} />
    </div>
  );
}

export type CardSize = "xs" | "sm" | "md" | "lg";

export const gridClass: Record<CardSize, string> = {
  xs: "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6",
  sm: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
  md: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  lg: "grid grid-cols-1 gap-4 lg:grid-cols-2",
};

interface LikedGridProps {
  typefaces: DirectoryEntry[];
  cardSize?: CardSize;
}

export function LikedGrid({ typefaces, cardSize = "md" }: LikedGridProps) {
  if (typefaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        No liked fonts yet. Hover a card and click the heart.
      </p>
    );
  }

  return (
    <div className={gridClass[cardSize]}>
      {typefaces.map((typeface) => (
        <SortableLikedCard
          key={`${typeface.foundrySlug}/${typeface.slug}`}
          typeface={typeface}
          size={cardSize}
        />
      ))}
    </div>
  );
}

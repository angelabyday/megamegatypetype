"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TypefaceCard } from "@/components/typeface-card";
import type { DirectoryEntry } from "@/lib/typefaces";

function SortableLikedCard({ typeface }: { typeface: DirectoryEntry }) {
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
      <TypefaceCard typeface={typeface} />
    </div>
  );
}

interface LikedGridProps {
  typefaces: DirectoryEntry[];
}

export function LikedGrid({ typefaces }: LikedGridProps) {
  if (typefaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        No liked fonts yet. Hover a card and click the heart.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {typefaces.map((typeface) => (
        <SortableLikedCard
          key={`${typeface.foundrySlug}/${typeface.slug}`}
          typeface={typeface}
        />
      ))}
    </div>
  );
}

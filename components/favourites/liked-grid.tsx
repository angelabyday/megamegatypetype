"use client";

import { useLikes } from "@/contexts/likes-context";
import { useFolders } from "@/contexts/folders-context";
import { TypefaceCard } from "@/components/typeface-card";
import { getAllTypefaces, toDirectoryEntry } from "@/lib/typefaces";
import { useDraggable } from "@dnd-kit/core";
import type { DirectoryEntry } from "@/lib/typefaces";

const allTypefaces = getAllTypefaces().map(toDirectoryEntry);

function DraggableFontCard({ typeface }: { typeface: DirectoryEntry }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${typeface.foundrySlug}/${typeface.slug}`,
    data: { foundrySlug: typeface.foundrySlug, typefaceSlug: typeface.slug },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="cursor-grab active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      <TypefaceCard typeface={typeface} />
    </div>
  );
}

export function LikedGrid() {
  const { likes } = useLikes();
  const { folders, addToFolder } = useFolders();

  const likedTypefaces = likes
    .map(({ foundrySlug, typefaceSlug }) =>
      allTypefaces.find(
        (t) => t.foundrySlug === foundrySlug && t.slug === typefaceSlug
      )
    )
    .filter(Boolean) as DirectoryEntry[];

  if (likedTypefaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8">
        No liked fonts yet. Hover a font card and click the heart.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {likedTypefaces.map((typeface) => (
        <div key={`${typeface.foundrySlug}/${typeface.slug}`} className="relative">
          <DraggableFontCard typeface={typeface} />
          {folders.length > 0 && (
            <div className="mt-1">
              <select
                className="w-full text-xs border-[0.5px] border-border rounded-md px-2 py-1 bg-background text-muted-foreground"
                defaultValue=""
                onChange={(e) => {
                  const folderId = parseInt(e.target.value);
                  if (folderId) {
                    addToFolder(folderId, typeface.foundrySlug, typeface.slug);
                    e.target.value = "";
                  }
                }}
              >
                <option value="" disabled>Add to folder…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { useFolders, type Folder } from "@/contexts/folders-context";
import { TypefaceCard } from "@/components/typeface-card";
import { getAllTypefaces, toDirectoryEntry } from "@/lib/typefaces";
import type { DirectoryEntry } from "@/lib/typefaces";

const allTypefaces = getAllTypefaces().map(toDirectoryEntry);

function SortableFolderFont({
  typeface,
  folderId,
  onRemove,
}: {
  typeface: DirectoryEntry;
  folderId: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `FF:${folderId}:${typeface.foundrySlug}/${typeface.slug}`,
    data: { type: "folder-font", folderId, foundrySlug: typeface.foundrySlug, typefaceSlug: typeface.slug },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className="relative touch-none"
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <TypefaceCard typeface={typeface} />
      </div>
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 z-20 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Remove from folder"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function FolderSection({ folder }: { folder: Folder }) {
  const { renameFolder, deleteFolder, removeFromFolder } = useFolders();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(folder.name);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `FZ:${folder.id}`,
    data: { folderId: folder.id },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `F:${folder.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fonts = folder.fonts
    .map(({ foundrySlug, typefaceSlug }) =>
      allTypefaces.find((t) => t.foundrySlug === foundrySlug && t.slug === typefaceSlug)
    )
    .filter(Boolean) as DirectoryEntry[];

  const fontIds = folder.fonts.map(
    (ff) => `FF:${folder.id}:${ff.foundrySlug}/${ff.typefaceSlug}`
  );

  const handleRename = () => {
    if (nameValue.trim() && nameValue.trim() !== folder.name) {
      renameFolder(folder.id, nameValue.trim());
    }
    setEditing(false);
  };

  return (
    <div ref={setSortRef} style={style}>
      {/* Folder header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder folder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {editing ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") { setNameValue(folder.name); setEditing(false); }
              }}
              className="flex-1 text-sm font-semibold bg-transparent border-b border-border outline-none"
            />
            <button onClick={handleRename} className="text-muted-foreground hover:text-foreground">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setNameValue(folder.name); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm flex-1">{folder.name}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Rename folder"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete folder "${folder.name}"? Fonts inside will not be deleted.`)) {
                  deleteFolder(folder.id);
                }
              }}
              className="text-muted-foreground hover:text-red-500"
              aria-label="Delete folder"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setDropRef}
        className={`min-h-24 rounded-xl border-[0.5px] transition-colors ${
          isOver
            ? "border-foreground bg-foreground/10"
            : fonts.length === 0
            ? "border-dashed border-border"
            : "border-transparent"
        }`}
      >
        {fonts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Drag fonts here
          </p>
        ) : (
          <SortableContext items={fontIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fonts.map((typeface) => (
                <SortableFolderFont
                  key={`${typeface.foundrySlug}/${typeface.slug}`}
                  typeface={typeface}
                  folderId={folder.id}
                  onRemove={() => removeFromFolder(folder.id, typeface.foundrySlug, typeface.slug)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

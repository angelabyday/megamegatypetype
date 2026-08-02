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
import { type CardSize, gridClass } from "@/components/favourites/liked-grid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const allTypefaces = getAllTypefaces().map(toDirectoryEntry);

function SortableFolderFont({
  typeface,
  folderId,
  onRemove,
  size,
}: {
  typeface: DirectoryEntry;
  folderId: number;
  onRemove: () => void;
  size?: CardSize;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
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
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.25 : 1,
        }}
        className="group relative touch-none"
      >
        <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
          <TypefaceCard typeface={typeface} size={size} />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          className="absolute top-2 right-[6.5rem] z-20 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Remove from drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from drawer?</AlertDialogTitle>
            <AlertDialogDescription>
              {typeface.name} will be removed from this drawer. The font stays in your liked fonts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function FolderSection({ folder, cardSize = "md" }: { folder: Folder; cardSize?: CardSize }) {
  const { renameFolder, deleteFolder, removeFromFolder } = useFolders();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(folder.name);
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false);

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
          aria-label="Drag to reorder drawer"
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
              aria-label="Rename drawer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeleteFolderOpen(true)}
              className="text-muted-foreground hover:text-red-500"
              aria-label="Delete drawer"
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
            ? "border-foreground bg-black/10 dark:bg-white/15"
            : fonts.length === 0
            ? "border-dashed border-border"
            : "border-transparent"
        }`}
      >
        {fonts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Drag fonts into this drawer
          </p>
        ) : (
          <SortableContext items={fontIds} strategy={rectSortingStrategy}>
            <div className={gridClass[cardSize]}>
              {fonts.map((typeface) => (
                <SortableFolderFont
                  key={`${typeface.foundrySlug}/${typeface.slug}`}
                  typeface={typeface}
                  folderId={folder.id}
                  onRemove={() => removeFromFolder(folder.id, typeface.foundrySlug, typeface.slug)}
                  size={cardSize}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      <AlertDialog open={deleteFolderOpen} onOpenChange={setDeleteFolderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{folder.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The drawer will be deleted. Fonts inside will not be removed from your liked fonts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFolder(folder.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

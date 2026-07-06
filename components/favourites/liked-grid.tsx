"use client";

import { useState, useRef, useEffect } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { useLikes } from "@/contexts/likes-context";
import { useFolders } from "@/contexts/folders-context";
import { TypefaceCard } from "@/components/typeface-card";
import { getAllTypefaces, toDirectoryEntry } from "@/lib/typefaces";
import { useDraggable } from "@dnd-kit/core";
import type { DirectoryEntry } from "@/lib/typefaces";

const allTypefaces = getAllTypefaces().map(toDirectoryEntry);

function AddToFolderButton({ foundrySlug, typefaceSlug }: { foundrySlug: string; typefaceSlug: string }) {
  const { folders, createFolder, addToFolder } = useFolders();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleAddExisting = (folderId: number) => {
    addToFolder(folderId, foundrySlug, typefaceSlug);
    setOpen(false);
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const folder = await createFolder(name);
    if (folder) addToFolder(folder.id, foundrySlug, typefaceSlug);
    setOpen(false);
    setCreating(false);
    setNewName("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        aria-label="Add to folder"
      >
        <Plus className="h-3 w-3" />
        Add to folder
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 min-w-44 rounded-lg border-[0.5px] border-border bg-background shadow-md py-1">
          {folders.length > 0 && (
            <>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleAddExisting(f.id)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  {f.name}
                </button>
              ))}
              <div className="my-1 border-t-[0.5px] border-border" />
            </>
          )}
          {creating ? (
            <div className="px-3 py-1.5 flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAdd();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Folder name"
                className="flex-1 text-sm bg-transparent outline-none border-b border-border"
              />
              <button onClick={handleCreateAndAdd} className="text-xs font-medium">Add</button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              New folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
        <div key={`${typeface.foundrySlug}/${typeface.slug}`}>
          <DraggableFontCard typeface={typeface} />
          <AddToFolderButton
            foundrySlug={typeface.foundrySlug}
            typefaceSlug={typeface.slug}
          />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { LikedGrid } from "@/components/favourites/liked-grid";
import { FolderSection } from "@/components/favourites/folder-section";
import { useFolders } from "@/contexts/folders-context";
import { useLikes } from "@/contexts/likes-context";

export default function FavouritesPage() {
  const { folders, createFolder, addToFolder, reorderFolders } = useFolders();
  const { likes } = useLikes();
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Font dragged onto a folder drop zone
    if (activeId.includes("/") && overId.startsWith("folder-")) {
      const folderId = parseInt(overId.replace("folder-", ""));
      const [foundrySlug, typefaceSlug] = activeId.split("/");
      addToFolder(folderId, foundrySlug, typefaceSlug);
      return;
    }

    // Folder reorder
    if (activeId.startsWith("folder-") && overId.startsWith("folder-")) {
      const activeFolder = parseInt(activeId.replace("folder-", ""));
      const overFolder = parseInt(overId.replace("folder-", ""));
      if (activeFolder === overFolder) return;
      const ids = folders.map((f) => f.id);
      const oldIndex = ids.indexOf(activeFolder);
      const newIndex = ids.indexOf(overFolder);
      const reordered = [...ids];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, activeFolder);
      reorderFolders(reordered);
    }
  }

  const handleCreate = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
    setNewFolderName("");
    setCreating(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        {/* Liked fonts */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold">
              Type cabinet
              {likes.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{likes.length}</span>
              )}
            </h1>
          </div>
          <LikedGrid />
        </section>

        {/* Folders */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Folders</h2>
            {creating ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name"
                  className="text-sm border-[0.5px] border-border rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 ring-foreground"
                />
                <button
                  onClick={handleCreate}
                  className="text-sm px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-80 transition-opacity"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border-[0.5px] border-border hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New folder
              </button>
            )}
          </div>

          {folders.length === 0 && !creating && (
            <p className="text-sm text-muted-foreground">No folders yet. Create one to organise your liked fonts.</p>
          )}

          <SortableContext
            items={folders.map((f) => `folder-${f.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-10">
              {folders.map((folder) => (
                <FolderSection key={folder.id} folder={folder} />
              ))}
            </div>
          </SortableContext>
        </section>
      </DndContext>
    </div>
  );
}

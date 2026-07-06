"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { LikedGrid } from "@/components/favourites/liked-grid";
import { FolderSection } from "@/components/favourites/folder-section";
import { useFolders } from "@/contexts/folders-context";
import { useLikes } from "@/contexts/likes-context";
import { getAllTypefaces, toDirectoryEntry } from "@/lib/typefaces";

const allTypefaces = getAllTypefaces().map(toDirectoryEntry);

type DragInfo = { name: string; foundry: string } | null;

export default function TypeCabinetPage() {
  const { folders, createFolder, addToFolder, reorderFolders, reorderFontsInFolder } = useFolders();
  const { likes, reorderLikes } = useLikes();
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dragInfo, setDragInfo] = useState<DragInfo>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const likedTypefaces = likes
    .map(({ foundrySlug, typefaceSlug }) =>
      allTypefaces.find((t) => t.foundrySlug === foundrySlug && t.slug === typefaceSlug)
    )
    .filter(Boolean);

  const likedIds = likedTypefaces.map((t) => `L:${t!.foundrySlug}/${t!.slug}`);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    let foundrySlug: string | undefined;
    let slug: string | undefined;

    if (id.startsWith("L:")) {
      [foundrySlug, slug] = id.slice(2).split("/");
    } else if (id.startsWith("FF:")) {
      const rest = id.slice(3).split(":")[1];
      if (rest) [foundrySlug, slug] = rest.split("/");
    }

    if (foundrySlug && slug) {
      const tf = allTypefaces.find((t) => t.foundrySlug === foundrySlug && t.slug === slug);
      if (tf) setDragInfo({ name: tf.name, foundry: tf.foundry });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragInfo(null);
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("L:")) {
      const [foundrySlug, typefaceSlug] = activeId.slice(2).split("/");

      if (overId.startsWith("FZ:")) {
        addToFolder(parseInt(overId.slice(3)), foundrySlug, typefaceSlug);
        return;
      }
      if (overId.startsWith("FF:")) {
        const folderId = parseInt(overId.slice(3).split(":")[0]);
        addToFolder(folderId, foundrySlug, typefaceSlug);
        return;
      }
      if (overId.startsWith("L:")) {
        const [overFoundry, overSlug] = overId.slice(2).split("/");
        const oldIdx = likes.findIndex((l) => l.foundrySlug === foundrySlug && l.typefaceSlug === typefaceSlug);
        const newIdx = likes.findIndex((l) => l.foundrySlug === overFoundry && l.typefaceSlug === overSlug);
        if (oldIdx !== -1 && newIdx !== -1) reorderLikes(arrayMove([...likes], oldIdx, newIdx));
        return;
      }
    }

    if (activeId.startsWith("FF:") && overId.startsWith("FF:")) {
      const activeRest = activeId.slice(3).split(":");
      const overRest = overId.slice(3).split(":");
      const activeFolderId = parseInt(activeRest[0]);
      const overFolderId = parseInt(overRest[0]);
      if (activeFolderId === overFolderId) {
        const folder = folders.find((f) => f.id === activeFolderId);
        if (!folder) return;
        const [aF, aS] = activeRest[1].split("/");
        const [oF, oS] = overRest[1].split("/");
        const oldIdx = folder.fonts.findIndex((ff) => ff.foundrySlug === aF && ff.typefaceSlug === aS);
        const newIdx = folder.fonts.findIndex((ff) => ff.foundrySlug === oF && ff.typefaceSlug === oS);
        if (oldIdx !== -1 && newIdx !== -1) {
          reorderFontsInFolder(activeFolderId, arrayMove([...folder.fonts], oldIdx, newIdx));
        }
      }
      return;
    }

    if (activeId.startsWith("F:") && overId.startsWith("F:")) {
      const ids = folders.map((f) => f.id);
      const oldIdx = ids.indexOf(parseInt(activeId.slice(2)));
      const newIdx = ids.indexOf(parseInt(overId.slice(2)));
      if (oldIdx !== -1 && newIdx !== -1) reorderFolders(arrayMove([...ids], oldIdx, newIdx));
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
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
          <SortableContext items={likedIds} strategy={rectSortingStrategy}>
            <LikedGrid typefaces={likedTypefaces as NonNullable<typeof likedTypefaces[0]>[]} />
          </SortableContext>
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
            <p className="text-sm text-muted-foreground">
              No folders yet. Create one, or drag a liked font onto a folder.
            </p>
          )}

          <SortableContext
            items={folders.map((f) => `F:${f.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-10">
              {folders.map((folder) => (
                <FolderSection key={folder.id} folder={folder} />
              ))}
            </div>
          </SortableContext>
        </section>

        {/* Drag overlay — tilted mini card */}
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {dragInfo && (
            <div
              className="rotate-2 scale-105 border-[0.5px] border-border rounded-[12px] bg-background px-4 py-3 w-52 cursor-grabbing pointer-events-none"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            >
              <div className="font-bold text-sm">{dragInfo.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{dragInfo.foundry}</div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

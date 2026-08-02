"use client";

import { useState, useRef, useEffect } from "react";
import { FolderPlus, FolderOpen, Plus } from "lucide-react";
import { useFolders } from "@/contexts/folders-context";
import { useAuth, useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface FolderButtonProps {
  foundrySlug: string;
  typefaceSlug: string;
  className?: string;
}

export function FolderButton({ foundrySlug, typefaceSlug, className }: FolderButtonProps) {
  const { folders, createFolder, addToFolder } = useFolders();
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
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

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) { openSignIn(); return; }
    setOpen((v) => !v);
  };

  const handleAddExisting = (e: React.MouseEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    addToFolder(folderId, foundrySlug, typefaceSlug);
    setOpen(false);
  };

  const handleCreateAndAdd = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
        type="button"
        onClick={handleClick}
        aria-label="Add to drawer"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-all",
          open
            ? "bg-foreground text-background opacity-100"
            : "bg-background/80 text-foreground opacity-0 group-hover:opacity-100",
          className
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute top-9 right-0 z-50 min-w-48 rounded-lg border-[0.5px] border-border bg-background shadow-lg py-1"
        >
          {folders.length > 0 && (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Add to drawer
              </p>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={(e) => handleAddExisting(e, f.id)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
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
                  e.stopPropagation();
                  if (e.key === "Enter") handleCreateAndAdd(e);
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Drawer name"
                className="flex-1 min-w-0 text-sm bg-transparent outline-none border-b border-border py-0.5"
              />
              <button
                onClick={handleCreateAndAdd}
                className="shrink-0 text-xs font-medium hover:text-foreground text-muted-foreground transition-colors"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCreating(true); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5 shrink-0" />
              Create drawer &amp; add
            </button>
          )}
        </div>
      )}
    </div>
  );
}

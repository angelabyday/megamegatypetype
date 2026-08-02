"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { X, ArrowRight, Columns2, ChevronRight, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare } from "@/contexts/compare-context";
import { useFolders } from "@/contexts/folders-context";
import { useAuth } from "@clerk/nextjs";

export function CompareSidebar() {
  const { items, remove, clear } = useCompare();
  const { createFolder, addToFolder } = useFolders();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  // Auto-expand when first item added
  useEffect(() => {
    if (items.length === 1) setCollapsed(false);
  }, [items.length]);

  if (!mounted) return null;
  if (pathname === "/compare") return null;
  if (items.length === 0) return null;

  const compareUrl = `/compare?t=${items.map((i) => `${i.foundrySlug}/${i.slug}`).join("&t=")}`;

  const handleSaveAsFolder = async () => {
    const name = folderName.trim() || "Compare";
    const folder = await createFolder(name);
    if (!folder) return;
    await Promise.all(items.map((i) => addToFolder(folder.id, i.foundrySlug, i.slug)));
    setSavingFolder(false);
    setFolderName("");
    clear();
    router.push("/type-cabinet");
  };

  // Collapsed: small tab on right edge
  if (collapsed) {
    return createPortal(
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-1.5 bg-foreground text-background px-2 py-4 rounded-l-[10px] shadow-xl hover:bg-foreground/90 transition-colors"
        aria-label="Open compare panel"
      >
        <Columns2 className="h-4 w-4" />
        <span className="text-xs font-medium tabular-nums">{items.length}</span>
      </button>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed top-0 right-0 h-full z-40 flex flex-col bg-background border-l-[0.5px] border-border shadow-2xl w-72 translate-x-0 transition-transform duration-300">
      {/* Collapse button */}
      <div className="h-[57px] flex items-center justify-end px-3 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
          aria-label="Collapse panel"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-border shrink-0">
        <span className="text-sm font-medium">
          Compare
          <span className="ml-2 text-muted-foreground font-normal">{items.length}/{8}</span>
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <div
            key={`${item.foundrySlug}/${item.slug}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 group/item"
          >
            {item.hasSpecimen ? (
              <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-[6px] bg-muted border-[0.5px] border-border">
                <Image
                  src={`/specimens/${item.foundrySlug}/${item.slug}.webp`}
                  alt={item.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-10 w-16 shrink-0 rounded-[6px] bg-muted border-[0.5px] border-border flex items-center justify-center">
                <span className="text-[9px] text-muted-foreground leading-tight text-center px-1">{item.foundry}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{item.name}</div>
              <div className="text-xs text-muted-foreground truncate">{item.foundry}</div>
            </div>
            <button
              type="button"
              onClick={() => remove(item.foundrySlug, item.slug)}
              className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 hover:text-foreground text-muted-foreground"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t-[0.5px] border-border shrink-0 space-y-2">
        <Link
          href={compareUrl}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          View Compare Sheet
          <ArrowRight className="h-4 w-4" />
        </Link>

        {isSignedIn && (
          savingFolder ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAsFolder();
                  if (e.key === "Escape") { setSavingFolder(false); setFolderName(""); }
                }}
                placeholder="Drawer name"
                className="flex-1 min-w-0 text-sm border-[0.5px] border-border rounded-md px-3 py-1.5 bg-background outline-none focus:ring-1 ring-foreground"
              />
              <button
                onClick={handleSaveAsFolder}
                className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-80 transition-opacity"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSavingFolder(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border-[0.5px] border-border px-4 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Save as drawer
            </button>
          )
        )}
      </div>
    </div>,
    document.body
  );
}

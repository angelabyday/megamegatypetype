"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

export type FolderFont = { foundrySlug: string; typefaceSlug: string };

export type Folder = {
  id: number;
  name: string;
  position: number;
  fonts: FolderFont[];
};

type FoldersContextValue = {
  folders: Folder[];
  createFolder: (name: string) => Promise<Folder | null>;
  renameFolder: (id: number, name: string) => Promise<void>;
  deleteFolder: (id: number) => Promise<void>;
  addToFolder: (folderId: number, foundrySlug: string, typefaceSlug: string) => Promise<void>;
  removeFromFolder: (folderId: number, foundrySlug: string, typefaceSlug: string) => Promise<void>;
  reorderFolders: (orderedIds: number[]) => Promise<void>;
};

const FoldersContext = createContext<FoldersContextValue>({
  folders: [],
  createFolder: async () => null,
  renameFolder: async () => {},
  deleteFolder: async () => {},
  addToFolder: async () => {},
  removeFromFolder: async () => {},
  reorderFolders: async () => {},
});

export function FoldersProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => setFolders(data.folders ?? []));
  }, [isLoaded, isSignedIn]);

  const createFolder = useCallback(async (name: string) => {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const { folder } = await res.json();
    setFolders((prev) => [...prev, folder]);
    return folder as Folder;
  }, []);

  const renameFolder = useCallback(async (id: number, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    await fetch(`/api/folders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }, []);

  const deleteFolder = useCallback(async (id: number) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
  }, []);

  const addToFolder = useCallback(
    async (folderId: number, foundrySlug: string, typefaceSlug: string) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId &&
          !f.fonts.some((ff) => ff.foundrySlug === foundrySlug && ff.typefaceSlug === typefaceSlug)
            ? { ...f, fonts: [...f.fonts, { foundrySlug, typefaceSlug }] }
            : f
        )
      );
      await fetch(`/api/folders/${folderId}/fonts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundrySlug, typefaceSlug }),
      });
    },
    []
  );

  const removeFromFolder = useCallback(
    async (folderId: number, foundrySlug: string, typefaceSlug: string) => {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? {
                ...f,
                fonts: f.fonts.filter(
                  (ff) => !(ff.foundrySlug === foundrySlug && ff.typefaceSlug === typefaceSlug)
                ),
              }
            : f
        )
      );
      await fetch(`/api/folders/${folderId}/fonts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundrySlug, typefaceSlug }),
      });
    },
    []
  );

  const reorderFolders = useCallback(async (orderedIds: number[]) => {
    setFolders((prev) => {
      const map = new Map(prev.map((f) => [f.id, f]));
      return orderedIds.map((id, i) => ({ ...map.get(id)!, position: i }));
    });
    await Promise.all(
      orderedIds.map((id, i) =>
        fetch(`/api/folders/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: i }),
        })
      )
    );
  }, []);

  return (
    <FoldersContext.Provider
      value={{ folders, createFolder, renameFolder, deleteFolder, addToFolder, removeFromFolder, reorderFolders }}
    >
      {children}
    </FoldersContext.Provider>
  );
}

export function useFolders() {
  return useContext(FoldersContext);
}

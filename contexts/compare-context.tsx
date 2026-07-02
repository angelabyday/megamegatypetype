"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CompareItem = {
  foundrySlug: string;
  slug: string;
  name: string;
  foundry: string;
  hasSpecimen: boolean;
};

type CompareContextValue = {
  items: CompareItem[];
  toggle: (item: CompareItem) => void;
  remove: (foundrySlug: string, slug: string) => void;
  clear: () => void;
  isInCompare: (foundrySlug: string, slug: string) => boolean;
  move: (from: number, to: number) => void;
};

const CompareContext = createContext<CompareContextValue | null>(null);

const STORAGE_KEY = "mmtt-compare";
const MAX_ITEMS = 8;

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  function persist(next: CompareItem[]) {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function toggle(item: CompareItem) {
    const exists = items.some(
      (i) => i.foundrySlug === item.foundrySlug && i.slug === item.slug
    );
    if (exists) {
      persist(items.filter((i) => !(i.foundrySlug === item.foundrySlug && i.slug === item.slug)));
    } else if (items.length < MAX_ITEMS) {
      persist([...items, item]);
    }
  }

  function remove(foundrySlug: string, slug: string) {
    persist(items.filter((i) => !(i.foundrySlug === foundrySlug && i.slug === slug)));
  }

  function clear() {
    persist([]);
  }

  function isInCompare(foundrySlug: string, slug: string) {
    return items.some((i) => i.foundrySlug === foundrySlug && i.slug === slug);
  }

  function move(from: number, to: number) {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persist(next);
  }

  return (
    <CompareContext.Provider value={{ items, toggle, remove, clear, isInCompare, move }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}

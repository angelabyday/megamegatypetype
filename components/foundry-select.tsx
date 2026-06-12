"use client";

import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FoundryInfo } from "@/lib/foundry-map";

interface Props {
  foundries: FoundryInfo[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function FoundrySelect({ foundries, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const filtered = foundries
    .filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  }

  function clear() {
    onChange(new Set());
    setQuery("");
  }

  const label =
    selected.size === 0
      ? "All foundries"
      : selected.size === 1
      ? [...selected][0]
      : `${selected.size} foundries`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between border-[0.5px] border-border px-3 py-2 text-sm transition-colors hover:bg-muted",
          open && "bg-muted"
        )}
      >
        <span className={selected.size === 0 ? "text-muted-foreground" : ""}>
          {label}
        </span>
        <svg
          className={cn("size-3 shrink-0 transition-transform", open && "rotate-180")}
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full border-[0.5px] border-border bg-background shadow-md">
          <div className="border-b-[0.5px] border-border p-2">
            <Input
              autoFocus
              placeholder="Search foundries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No match</p>
            ) : (
              filtered.map((f) => (
                <label
                  key={f.slug}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.has(f.name)}
                    onCheckedChange={() => toggle(f.name)}
                  />
                  {f.name}
                </label>
              ))
            )}
          </div>
          {selected.size > 0 && (
            <div className="border-t-[0.5px] border-border p-2">
              <button
                type="button"
                onClick={clear}
                className="w-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

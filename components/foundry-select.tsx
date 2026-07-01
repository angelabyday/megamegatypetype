"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center rounded-full bg-foreground text-background px-3 py-2 text-sm transition-colors hover:bg-foreground/90"
      >
        <span>{label}</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          {/* Panel — full width, below site header */}
          <div className="absolute inset-x-0 top-20 bg-background border-b border-border shadow-xl flex flex-col max-h-[calc(100vh-5rem)]">
            {/* Header row */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 border-b border-border shrink-0">
              <span className="text-sm font-medium">
                Foundry
                {selected.size > 0 && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    {selected.size} selected
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 sm:px-6 shrink-0">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foundries…"
                className="h-8 w-full rounded-full border-[0.5px] border-border bg-muted px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground/40"
              />
            </div>

            {/* Roundels */}
            <div className="overflow-y-auto px-4 pb-5 sm:px-6">
              {filtered.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No foundries match &ldquo;{query}&rdquo;</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filtered.map((f) => {
                    const active = selected.has(f.name);
                    return (
                      <button
                        key={f.slug}
                        type="button"
                        onClick={() => toggle(f.name)}
                        className={cn(
                          "rounded-full border-[0.5px] px-3 py-1 text-xs transition-colors",
                          active
                            ? "bg-foreground text-background border-transparent"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

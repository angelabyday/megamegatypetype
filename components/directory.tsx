"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FoundrySelect } from "@/components/foundry-select";
import { TypefaceCard } from "@/components/typeface-card";
import { CATEGORIES, type Category, type DirectoryEntry } from "@/lib/typefaces";
import type { FoundryInfo } from "@/lib/foundry-map";
import { cn } from "@/lib/utils";

type SortKey = "name" | "foundry" | "year-desc" | "year-asc";

function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const USE_CASES: { label: string; tags: string[] }[] = [
  { label: "Display",         tags: ["display"] },
  { label: "Editorial",       tags: ["editorial"] },
  { label: "Body Copy",       tags: ["text", "book", "body", "long-form", "reading"] },
  { label: "Branding",        tags: ["branding", "identity", "logo", "logotype"] },
  { label: "Headline",        tags: ["headline", "headlines", "poster"] },
  { label: "Signage",         tags: ["signage", "wayfinding"] },
  { label: "UI / Screen",     tags: ["ui", "screen", "interface"] },
  { label: "Coding",          tags: ["coding", "code", "monospaced", "monospace", "mono"] },
];

const STYLES: { label: string; tags: string[] }[] = [
  { label: "Geometric",       tags: ["geometric"] },
  { label: "Humanist",        tags: ["humanist", "humanist-sans", "humanist-serif", "humanist sans", "humanist serif"] },
  { label: "Grotesque",       tags: ["grotesque", "neo-grotesque", "grotesk"] },
  { label: "Swiss / Neutral", tags: ["swiss", "neutral"] },
  { label: "Expressive",      tags: ["expressive"] },
  { label: "Decorative",      tags: ["decorative"] },
  { label: "Retro / Revival", tags: ["retro", "vintage", "revival"] },
  { label: "High Contrast",   tags: ["high-contrast", "high contrast"] },
  { label: "Rounded",         tags: ["rounded"] },
  { label: "Industrial",      tags: ["industrial"] },
  { label: "Calligraphic",    tags: ["calligraphic"] },
  { label: "Stencil",         tags: ["stencil"] },
  { label: "Transitional",    tags: ["transitional"] },
  { label: "Playful",         tags: ["playful", "friendly"] },
  { label: "Modular",         tags: ["modular"] },
];

function CollapsibleSection({
  label,
  collapsible,
  children,
}: {
  label: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className="mt-5">
      {collapsible ? (
        <button
          className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(!open)}
        >
          {label}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      ) : (
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
      )}
      {open && children}
    </div>
  );
}

export function Directory({
  typefaces,
  foundries,
}: {
  typefaces: DirectoryEntry[];
  foundries: FoundryInfo[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [selectedFoundries, setSelectedFoundries] = useState<Set<string>>(new Set());
  const [selectedUseCases, setSelectedUseCases] = useState<Set<string>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [condensedOnly, setCondensedOnly] = useState(false);
  const [italicOnly, setItalicOnly] = useState(false);
  const [monoOnly, setMonoOnly] = useState(false);
  const [variableOnly, setVariableOnly] = useState(false);
  const [wideOnly, setWideOnly] = useState(false);
  const [opticalSizesOnly, setOpticalSizesOnly] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<"foundry" | "reseller" | "free">>(
    new Set(["foundry", "reseller", "free"])
  );
  const [sort, setSort] = useState<SortKey>("name");
  const [visibleCount, setVisibleCount] = useState(60);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) +
    selectedFoundries.size +
    selectedUseCases.size +
    selectedStyles.size +
    (condensedOnly ? 1 : 0) +
    (italicOnly ? 1 : 0) +
    (monoOnly ? 1 : 0) +
    (variableOnly ? 1 : 0) +
    (wideOnly ? 1 : 0) +
    (opticalSizesOnly ? 1 : 0) +
    (selectedTypes.size < 3 ? 1 : 0);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const list = typefaces.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (selectedFoundries.size > 0 && !selectedFoundries.has(t.foundry)) return false;
      if (selectedUseCases.size > 0) {
        const tagSet = new Set(t.tags);
        const match = [...selectedUseCases].some((label) =>
          USE_CASES.find((u) => u.label === label)?.tags.some((tag) => tagSet.has(tag))
        );
        if (!match) return false;
      }
      if (selectedStyles.size > 0) {
        const tagSet = new Set(t.tags);
        const match = [...selectedStyles].some((label) =>
          STYLES.find((s) => s.label === label)?.tags.some((tag) => tagSet.has(tag))
        );
        if (!match) return false;
      }
      if (!selectedTypes.has(t.type as "foundry" | "reseller" | "free")) return false;
      if (condensedOnly && !t.has_condensed) return false;
      if (italicOnly && !t.has_italic) return false;
      if (monoOnly && !t.has_mono) return false;
      if (variableOnly && !t.tags.includes("variable")) return false;
      if (wideOnly && !t.tags.some((tag) => ["wide", "multi-width"].includes(tag))) return false;
      if (opticalSizesOnly && !t.tags.includes("optical-sizes")) return false;
      if (q) {
        const haystack = fold(
          [t.name, t.foundry, t.designer ?? "", t.summary, t.subcategory ?? "", ...t.tags].join(" ")
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      switch (sort) {
        case "foundry":
          return a.foundry.localeCompare(b.foundry) || a.name.localeCompare(b.name);
        case "year-desc":
          if (a.year === null && b.year === null) return a.name.localeCompare(b.name);
          if (a.year === null) return 1;
          if (b.year === null) return -1;
          return b.year - a.year || a.name.localeCompare(b.name);
        case "year-asc":
          if (a.year === null && b.year === null) return a.name.localeCompare(b.name);
          if (a.year === null) return 1;
          if (b.year === null) return -1;
          return a.year - b.year || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [typefaces, query, category, selectedFoundries, selectedUseCases, selectedStyles, condensedOnly, italicOnly, monoOnly, variableOnly, wideOnly, opticalSizesOnly, selectedTypes, sort]);

  useEffect(() => {
    setVisibleCount(60);
  }, [query, category, selectedFoundries, selectedUseCases, selectedStyles, condensedOnly, italicOnly, monoOnly, variableOnly, wideOnly, opticalSizesOnly, selectedTypes, sort]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((n) => n + 60);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (mobileFiltersOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileFiltersOpen]);

  function toggle<T>(set: Set<T>, value: T, update: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  }

  function renderFilters(collapsible: boolean) {
    return (
      <>
        <CollapsibleSection label="Category" collapsible={false}>
          <div className="flex flex-wrap gap-1">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as Category | "all")}
                className={cn(
                  "rounded-full border-[0.5px] border-border px-2 py-1 text-xs transition-colors",
                  category === c ? "bg-foreground text-background" : "hover:bg-muted"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="Source" collapsible={false}>
          <div className="flex flex-wrap gap-1">
            {(["foundry", "reseller", "free"] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggle(selectedTypes, t, setSelectedTypes)}
                className={cn(
                  "rounded-full border-[0.5px] border-border px-2 py-1 text-xs capitalize transition-colors",
                  selectedTypes.has(t) ? "bg-foreground text-background" : "hover:bg-muted"
                )}
              >
                {t === "foundry" ? "Foundries" : t === "reseller" ? "Resellers" : "Free"}
              </button>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="Foundry" collapsible={collapsible}>
          <FoundrySelect
            foundries={foundries}
            selected={selectedFoundries}
            onChange={setSelectedFoundries}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Use Case" collapsible={collapsible}>
          <div className="flex flex-col gap-1.5">
            {USE_CASES.map(({ label }) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedUseCases.has(label)}
                  onCheckedChange={() => toggle(selectedUseCases, label, setSelectedUseCases)}
                />
                {label}
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="Style" collapsible={collapsible}>
          <div className="flex flex-col gap-1.5">
            {STYLES.map(({ label }) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedStyles.has(label)}
                  onCheckedChange={() => toggle(selectedStyles, label, setSelectedStyles)}
                />
                {label}
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="Features" collapsible={collapsible}>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={condensedOnly} onCheckedChange={() => setCondensedOnly(!condensedOnly)} />
              Has condensed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={italicOnly} onCheckedChange={() => setItalicOnly(!italicOnly)} />
              Has italic
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={monoOnly} onCheckedChange={() => setMonoOnly(!monoOnly)} />
              Has mono
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={variableOnly} onCheckedChange={() => setVariableOnly(!variableOnly)} />
              Variable font
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={wideOnly} onCheckedChange={() => setWideOnly(!wideOnly)} />
              Wide / extended
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={opticalSizesOnly} onCheckedChange={() => setOpticalSizesOnly(!opticalSizesOnly)} />
              Optical sizes
            </label>
          </div>
        </CollapsibleSection>
      </>
    );
  }

  return (
    <div className="mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-full shrink-0 lg:block lg:w-60 lg:sticky lg:top-20 lg:self-start">
        <Input
          type="search"
          placeholder="Name, foundry, style, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search typefaces"
        />
        {renderFilters(false)}
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center gap-3 lg:hidden">
        <Input
          type="search"
          placeholder="Name, foundry, style, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search typefaces"
          className="flex-1"
        />
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-2 text-xs transition-colors",
            activeFilterCount > 0 ? "bg-foreground text-background" : "hover:bg-muted"
          )}
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground text-[10px] font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile filter sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
          />
          {/* Panel */}
          <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col overflow-hidden bg-background shadow-xl sm:top-auto sm:rounded-t-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-medium">Filters</span>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full p-1 hover:bg-muted transition-colors"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {renderFilters(true)}
            </div>
            <div className="border-t border-border p-4">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full rounded-full bg-foreground py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90"
              >
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {typefaces.length} typefaces from{" "}
            <Link href="/foundries" className="underline underline-offset-2 hover:text-foreground transition-colors">
              {new Set(filtered.map((t) => t.foundry)).size} type foundries
            </Link>
          </p>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44" aria-label="Sort typefaces">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name A to Z</SelectItem>
              <SelectItem value="foundry">Foundry</SelectItem>
              <SelectItem value="year-desc">Year, newest</SelectItem>
              <SelectItem value="year-asc">Year, oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nothing matches those filters. Loosen one and try again.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 min-[2200px]:grid-cols-4">
              {filtered.slice(0, visibleCount).map((t, i) => (
                <TypefaceCard key={`${t.foundrySlug}/${t.slug}`} typeface={t} priority={i < 2} />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div ref={loadMoreRef} className="py-8 text-center text-sm text-muted-foreground">
                Loading more…
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

// Fold diacritics so "sohne" finds Söhne.
function fold(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}


const USE_CASES: { label: string; tags: string[] }[] = [
  { label: "Display",         tags: ["display"] },
  { label: "Editorial",       tags: ["editorial"] },
  { label: "Body Copy",        tags: ["text", "book", "body", "long-form", "reading"] },
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
];

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
  const [sort, setSort] = useState<SortKey>("name");
  const [visibleCount, setVisibleCount] = useState(60);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
      if (condensedOnly && !t.has_condensed) return false;
      if (italicOnly && !t.has_italic) return false;
      if (monoOnly && !t.has_mono) return false;
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
  }, [typefaces, query, category, selectedFoundries, selectedUseCases, selectedStyles, condensedOnly, italicOnly, monoOnly, sort]);

  useEffect(() => {
    setVisibleCount(60);
  }, [query, category, selectedFoundries, selectedUseCases, selectedStyles, condensedOnly, italicOnly, monoOnly, sort]);

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

  function toggle<T>(set: Set<T>, value: T, update: (next: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  }

  return (
    <div className="mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-60 lg:sticky lg:top-6 lg:self-start">
        <Input
          type="search"
          placeholder="Name, foundry, style, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search typefaces"
        />

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Category
          </h2>
          <div className="flex flex-wrap gap-1">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as Category | "all")}
                className={cn(
                  "rounded-full border-[0.5px] border-border px-2 py-1 text-xs transition-colors",
                  category === c
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Foundry
          </h2>
          <FoundrySelect
            foundries={foundries}
            selected={selectedFoundries}
            onChange={setSelectedFoundries}
          />
        </div>

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Use Case
          </h2>
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
        </div>

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Style
          </h2>
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
        </div>

        <div className="mt-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Features
          </h2>
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
          </div>
        </div>
      </aside>

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

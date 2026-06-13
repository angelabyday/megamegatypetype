"use client";

import { useMemo, useState } from "react";
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
import { CATEGORIES, TIERS, type Category, type DirectoryEntry, type Tier } from "@/lib/typefaces";
import type { FoundryInfo } from "@/lib/foundry-map";
import { cn } from "@/lib/utils";

type SortKey = "name" | "foundry" | "year-desc" | "year-asc";

// Fold diacritics so "sohne" finds Söhne.
function fold(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const TIER_LABELS: Record<Tier, string> = {
  best: "Best",
  good: "Good",
  okay: "Okay",
  notgood: "Not good",
};

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
  const [selectedTiers, setSelectedTiers] = useState<Set<Tier>>(new Set());
  const [condensedOnly, setCondensedOnly] = useState(false);
  const [italicOnly, setItalicOnly] = useState(false);
  const [monoOnly, setMonoOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    const list = typefaces.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (selectedFoundries.size > 0 && !selectedFoundries.has(t.foundry)) return false;
      if (selectedTiers.size > 0 && !selectedTiers.has(t.tier)) return false;
      if (condensedOnly && !t.has_condensed) return false;
      if (italicOnly && !t.has_italic) return false;
      if (monoOnly && !t.has_mono) return false;
      if (q) {
        const haystack = fold(
          [t.name, t.foundry, t.designer ?? "", t.summary, ...t.tags].join(" ")
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
  }, [typefaces, query, category, selectedFoundries, selectedTiers, condensedOnly, italicOnly, monoOnly, sort]);

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
          placeholder="Search name, foundry, designer, tags"
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
                  "border-[0.5px] border-border px-2 py-1 text-xs transition-colors",
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
            Tier
          </h2>
          <div className="flex flex-col gap-1.5">
            {TIERS.map((tier) => (
              <label key={tier} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedTiers.has(tier)}
                  onCheckedChange={() => toggle(selectedTiers, tier, setSelectedTiers)}
                />
                {TIER_LABELS[tier]}
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
            Showing {filtered.length} of {typefaces.length} typefaces
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((t) => (
              <TypefaceCard key={`${t.foundrySlug}/${t.slug}`} typeface={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

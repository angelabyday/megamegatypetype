"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type StoredResult = {
  foundrySlug: string | null;
  slug: string | null;
  name: string;
};

// Shows previous/next controls on a typeface page reached from brief-mode
// results. Reads the same sessionStorage the brief form persists to; renders
// nothing unless the URL carries ?from=brief and the typeface is in the
// stored result list.
export function BriefResultNav({
  foundrySlug,
  slug,
}: {
  foundrySlug: string;
  slug: string;
}) {
  const searchParams = useSearchParams();
  const fromBrief = searchParams.get("from") === "brief";
  const [results, setResults] = useState<StoredResult[]>([]);

  useEffect(() => {
    if (!fromBrief) return;
    try {
      const saved = sessionStorage.getItem("brief-state");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.state?.status === "results") {
        setResults(parsed.state.results ?? []);
      }
    } catch {
      // No saved results; render nothing.
    }
  }, [fromBrief]);

  if (!fromBrief || results.length === 0) return null;

  const index = results.findIndex(
    (r) => r.foundrySlug === foundrySlug && r.slug === slug
  );
  if (index === -1) return null;

  const linkable = (r: StoredResult | undefined) =>
    r && r.foundrySlug && r.slug ? r : undefined;
  // Skip outside-list entries (no detail page).
  let prev;
  for (let i = index - 1; i >= 0; i--) {
    if (linkable(results[i])) {
      prev = results[i];
      break;
    }
  }
  let next;
  for (let i = index + 1; i < results.length; i++) {
    if (linkable(results[i])) {
      next = results[i];
      break;
    }
  }

  return (
    <nav
      aria-label="Brief results"
      className="mb-6 flex items-center justify-between gap-4 border-[0.5px] border-border px-3 py-2 text-sm"
    >
      <Link href="/brief" className="hover:underline underline-offset-4">
        ← All results
      </Link>
      <span className="text-muted-foreground">
        Result {index + 1} of {results.length}
      </span>
      <div className="flex gap-2">
        <Button asChild={Boolean(prev)} variant="outline" size="sm" disabled={!prev}>
          {prev ? (
            <Link href={`/t/${prev.foundrySlug}/${prev.slug}?from=brief`}>Back</Link>
          ) : (
            <span>Back</span>
          )}
        </Button>
        <Button asChild={Boolean(next)} variant="outline" size="sm" disabled={!next}>
          {next ? (
            <Link href={`/t/${next.foundrySlug}/${next.slug}?from=brief`}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </div>
    </nav>
  );
}

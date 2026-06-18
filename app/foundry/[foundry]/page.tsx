import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TypefaceCard } from "@/components/typeface-card";
import { ReportMissingButton } from "@/components/report-missing-dialog";
import { FOUNDRIES, getFoundryBySlug } from "@/lib/foundry-map";
import { getTypefacesByFoundrySlug, toDirectoryEntry } from "@/lib/typefaces";

type Params = { foundry: string };

export function generateStaticParams(): Params[] {
  return FOUNDRIES.map((f) => ({ foundry: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { foundry } = await params;
  const info = getFoundryBySlug(foundry);
  if (!info) return {};
  return {
    title: info.name,
    description: `Typefaces by ${info.name} in the MegaMegaTypeType directory.`,
  };
}

export default async function FoundryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { foundry } = await params;
  const info = getFoundryBySlug(foundry);
  if (!info) notFound();

  const typefaces = getTypefacesByFoundrySlug(foundry)
    .map(toDirectoryEntry)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">{info.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {typefaces.length} {typefaces.length === 1 ? "typeface" : "typefaces"} in
        the directory ·{" "}
        <a
          href={info.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-4"
        >
          {new URL(info.homepage).hostname.replace(/^www\./, "")}
        </a>
      </p>
      <ReportMissingButton foundryName={info.name} />
      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {typefaces.map((t) => (
          <TypefaceCard key={t.slug} typeface={t} />
        ))}
      </div>
    </div>
  );
}

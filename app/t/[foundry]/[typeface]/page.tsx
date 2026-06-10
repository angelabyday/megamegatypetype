import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFoundryByName } from "@/lib/foundry-map";
import {
  getAllTypefaces,
  getTypefaceByFoundryAndSlug,
  slugify,
} from "@/lib/typefaces";

type Params = { foundry: string; typeface: string };

export function generateStaticParams(): Params[] {
  return getAllTypefaces().map((t) => ({
    foundry: t.foundrySlug,
    typeface: t.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { foundry, typeface } = await params;
  const t = getTypefaceByFoundryAndSlug(foundry, typeface);
  if (!t) return {};
  return {
    title: `${t.name} by ${t.foundry}`,
    description: t.summary || `${t.name}, a ${t.category} typeface by ${t.foundry}.`,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t-[0.5px] border-border pt-4">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="border-[0.5px] border-border px-1.5 py-0.5 text-xs"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default async function TypefacePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { foundry, typeface } = await params;
  const t = getTypefaceByFoundryAndSlug(foundry, typeface);
  if (!t) notFound();

  const foundryInfo = getFoundryByName(t.foundry);
  const relatedSubfamilies = t.subfamilies.filter(
    (s) => slugify(s) !== t.slug
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t.name}</h1>
          <p className="mt-1 text-muted-foreground">
            <Link href={`/foundry/${t.foundrySlug}`} className="hover:underline underline-offset-4">
              {t.foundry}
            </Link>
            {t.designer ? ` · ${t.designer}` : ""}
            {t.year ? ` · ${t.year}` : ""}
          </p>
        </div>
        <Button asChild>
          <a href={t.url} target="_blank" rel="noopener noreferrer">
            View on {foundryInfo?.name ?? t.foundry}
          </a>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge variant="default">{t.category}</Badge>
        {t.subcategory && <Badge variant="outline">{t.subcategory}</Badge>}
        {t.has_condensed && <Badge variant="outline">condensed</Badge>}
        {t.has_italic && <Badge variant="outline">italic</Badge>}
        {t.has_mono && <Badge variant="outline">mono</Badge>}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {t.summary && <p className="text-lg">{t.summary}</p>}

        {t.description && (
          <Section title="About">
            <p className="text-sm leading-relaxed">{t.description}</p>
          </Section>
        )}

        {t.classification_notes && (
          <Section title="Classification">
            <p className="text-sm leading-relaxed">{t.classification_notes}</p>
          </Section>
        )}

        {t.weights.length > 0 && (
          <Section title="Weights">
            <ChipList items={t.weights} />
          </Section>
        )}

        {t.optical_sizes_or_widths.filter((o) => o !== "standard").length > 0 && (
          <Section title="Optical sizes and widths">
            <ChipList items={t.optical_sizes_or_widths} />
          </Section>
        )}

        {relatedSubfamilies.length > 0 && (
          <Section title="Family">
            <div className="flex flex-wrap gap-1">
              {relatedSubfamilies.map((s) => {
                const related = getTypefaceByFoundryAndSlug(t.foundrySlug, slugify(s));
                return related ? (
                  <Link
                    key={s}
                    href={`/t/${related.foundrySlug}/${related.slug}`}
                    className="border-[0.5px] border-border px-1.5 py-0.5 text-xs hover:bg-muted"
                  >
                    {s}
                  </Link>
                ) : (
                  <span key={s} className="border-[0.5px] border-border px-1.5 py-0.5 text-xs">
                    {s}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {t.languages.length > 0 && (
          <Section title="Languages">
            <ChipList items={t.languages} />
          </Section>
        )}

        {t.tags.length > 0 && (
          <Section title="Tags">
            <ChipList items={t.tags} />
          </Section>
        )}
      </div>
    </article>
  );
}

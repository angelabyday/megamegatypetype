"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, X, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useCompare, type CompareItem } from "@/contexts/compare-context";
import { hasSpecimen } from "@/components/typeface-card";

export default function ComparePage() {
  const { items, remove, clear, move } = useCompare();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 text-center">
        <p className="text-muted-foreground text-sm">No typefaces selected for comparison.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm hover:text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="text-lg font-bold">
            Compare <span className="text-muted-foreground font-normal">({items.length})</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      {/* Comparison grid */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => (
          <CompareColumn
            key={`${item.foundrySlug}/${item.slug}`}
            item={item}
            index={index}
            total={items.length}
            onRemove={() => remove(item.foundrySlug, item.slug)}
            onMoveLeft={() => move(index, index - 1)}
            onMoveRight={() => move(index, index + 1)}
          />
        ))}
      </div>
    </div>
  );
}

function CompareColumn({
  item,
  index,
  total,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  item: CompareItem;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const specimen = item.hasSpecimen;

  return (
    <div className="flex flex-col rounded-[12px] border-[0.5px] border-border overflow-hidden">
      {/* Specimen */}
      <div className="relative aspect-[4/3] w-full bg-muted border-b-[0.5px] border-border">
        {specimen ? (
          <Image
            src={`/specimens/${item.foundrySlug}/${item.slug}.webp`}
            alt={item.name}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-xs">{item.foundry}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <div className="font-bold text-sm leading-tight">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{item.foundry}</div>
        </div>

        <Link
          href={`/t/${item.foundrySlug}/${item.slug}`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors w-fit"
        >
          View details
        </Link>
      </div>

      {/* Controls */}
      <div className="flex items-center border-t-[0.5px] border-border">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={index === 0}
          className="p-2.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={index === total - 1}
          className="p-2.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="p-2.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Remove from compare"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

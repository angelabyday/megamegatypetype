"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompare } from "@/contexts/compare-context";

export function CompareSidebar() {
  const { items, remove, clear } = useCompare();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const open = items.length > 0;
  const compareUrl = `/compare?t=${items.map((i) => `${i.foundrySlug}/${i.slug}`).join("&t=")}`;

  return createPortal(
    <div
      className={cn(
        "fixed top-0 right-0 h-full z-40 flex flex-col bg-background border-l-[0.5px] border-border shadow-2xl transition-transform duration-300 w-72",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-border shrink-0 mt-[57px]">
        <span className="text-sm font-medium">
          Compare
          <span className="ml-2 text-muted-foreground font-normal">{items.length}/{8}</span>
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {items.map((item) => (
          <div
            key={`${item.foundrySlug}/${item.slug}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 group/item"
          >
            {item.hasSpecimen ? (
              <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-[6px] bg-muted border-[0.5px] border-border">
                <Image
                  src={`/specimens/${item.foundrySlug}/${item.slug}.webp`}
                  alt={item.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-10 w-16 shrink-0 rounded-[6px] bg-muted border-[0.5px] border-border flex items-center justify-center">
                <span className="text-[9px] text-muted-foreground leading-tight text-center px-1">{item.foundry}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{item.name}</div>
              <div className="text-xs text-muted-foreground truncate">{item.foundry}</div>
            </div>
            <button
              type="button"
              onClick={() => remove(item.foundrySlug, item.slug)}
              className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 hover:text-foreground text-muted-foreground"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t-[0.5px] border-border shrink-0">
        <Link
          href={compareUrl}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          View Compare Sheet
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>,
    document.body
  );
}

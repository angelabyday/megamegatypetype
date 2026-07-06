"use client";

import { Heart } from "lucide-react";
import { useLikes } from "@/contexts/likes-context";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  foundrySlug: string;
  typefaceSlug: string;
  className?: string;
}

export function LikeButton({ foundrySlug, typefaceSlug, className }: LikeButtonProps) {
  const { isLiked, toggle } = useLikes();
  const liked = isLiked(foundrySlug, typefaceSlug);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(foundrySlug, typefaceSlug);
      }}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full transition-all",
        liked
          ? "bg-foreground text-background opacity-100"
          : "bg-background/80 text-foreground opacity-0 group-hover:opacity-100",
        className
      )}
    >
      <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

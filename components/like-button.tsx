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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(foundrySlug, typefaceSlug);
      }}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "flex items-center justify-center rounded-full p-1.5 transition-colors",
        liked
          ? "text-red-500 hover:text-red-400"
          : "text-background/70 hover:text-background",
        className
      )}
    >
      <Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />
    </button>
  );
}

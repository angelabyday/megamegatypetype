"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";

type LikeKey = { foundrySlug: string; typefaceSlug: string };

type LikesContextValue = {
  likes: LikeKey[];
  isLiked: (foundrySlug: string, typefaceSlug: string) => boolean;
  toggle: (foundrySlug: string, typefaceSlug: string) => Promise<void>;
};

const LikesContext = createContext<LikesContextValue>({
  likes: [],
  isLiked: () => false,
  toggle: async () => {},
});

export function LikesProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn } = useClerk();
  const [likes, setLikes] = useState<LikeKey[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/likes")
      .then((r) => r.json())
      .then((data) => setLikes(data.liked ?? []));
  }, [isLoaded, isSignedIn]);

  const isLiked = useCallback(
    (foundrySlug: string, typefaceSlug: string) =>
      likes.some((l) => l.foundrySlug === foundrySlug && l.typefaceSlug === typefaceSlug),
    [likes]
  );

  const toggle = useCallback(
    async (foundrySlug: string, typefaceSlug: string) => {
      if (!isSignedIn) {
        openSignIn();
        return;
      }
      const wasLiked = likes.some(
        (l) => l.foundrySlug === foundrySlug && l.typefaceSlug === typefaceSlug
      );
      setLikes((prev) =>
        wasLiked
          ? prev.filter((l) => !(l.foundrySlug === foundrySlug && l.typefaceSlug === typefaceSlug))
          : [...prev, { foundrySlug, typefaceSlug }]
      );
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundrySlug, typefaceSlug }),
      });
      if (!res.ok) {
        setLikes((prev) =>
          wasLiked
            ? [...prev, { foundrySlug, typefaceSlug }]
            : prev.filter((l) => !(l.foundrySlug === foundrySlug && l.typefaceSlug === typefaceSlug))
        );
      }
    },
    [isSignedIn, likes, openSignIn]
  );

  return (
    <LikesContext.Provider value={{ likes, isLiked, toggle }}>
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  return useContext(LikesContext);
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ResultItem = {
  name: string;
  foundry: string;
  foundrySlug: string | null;
  slug: string | null;
  reason: string;
  outsideList: boolean;
};

type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "questions"; questions: string[] }
  | { status: "results"; results: ResultItem[] }
  | { status: "error"; message: string };

const STORAGE_KEY = "brief-state";

export function BriefForm() {
  const [brief, setBrief] = useState("");
  const [state, setState] = useState<BriefState>({ status: "idle" });
  const [answers, setAnswers] = useState<string[]>([]);

  // Survive navigation to a result and back: state lives in sessionStorage.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        brief: string;
        state: BriefState;
        answers: string[];
      };
      setBrief(parsed.brief ?? "");
      setAnswers(parsed.answers ?? []);
      if (parsed.state && parsed.state.status !== "loading") {
        setState(parsed.state);
      }
    } catch {
      // Corrupt or absent saved state; start fresh.
    }
  }, []);

  useEffect(() => {
    if (state.status === "loading") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ brief, state, answers })
      );
    } catch {
      // Storage full or unavailable; nothing to do.
    }
  }, [brief, state, answers]);

  async function submit(withAnswers?: { question: string; answer: string }[]) {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, answers: withAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      if (data.type === "questions") {
        setAnswers(new Array(data.questions.length).fill(""));
        setState({ status: "questions", questions: data.questions });
      } else {
        setState({ status: "results", results: data.results });
      }
    } catch {
      setState({ status: "error", message: "Network error. Try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (brief.trim()) submit();
        }}
        className="flex flex-col gap-3"
      >
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Modern editorial serif for a wellness brand. Premium but approachable. No fashion didone."
          rows={4}
          maxLength={4000}
          aria-label="Describe your brief"
        />
        <div>
          <Button type="submit" disabled={loading || !brief.trim()}>
            {loading ? "Matching…" : "Find typefaces"}
          </Button>
        </div>
      </form>

      {state.status === "questions" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(
              state.questions.map((q, i) => ({
                question: q,
                answer: answers[i]?.trim() || "I don't know",
              }))
            );
          }}
          className="flex flex-col gap-4 border-[0.5px] border-border p-4"
        >
          <p className="text-sm">
            A bit more detail would sharpen the matches. &ldquo;I don&rsquo;t
            know&rdquo; is a fine answer; leave anything blank and we&rsquo;ll
            decide for you.
          </p>
          {state.questions.map((q, i) => (
            <label key={q} className="flex flex-col gap-1.5 text-sm">
              {q}
              <Input
                value={answers[i] ?? ""}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
                placeholder="I don't know"
              />
            </label>
          ))}
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? "Matching…" : "Get matches"}
            </Button>
          </div>
        </form>
      )}

      {state.status === "results" && (
        <ol className="flex flex-col">
          {state.results.map((r, i) => (
            <li
              key={`${r.foundry}/${r.name}`}
              className="flex gap-4 border-b-[0.5px] border-border py-3 first:border-t-[0.5px]"
            >
              <span className="w-6 shrink-0 text-sm text-muted-foreground">
                {i + 1}
              </span>
              <div>
                <div className="font-bold">
                  {r.slug && r.foundrySlug ? (
                    <Link
                      href={`/t/${r.foundrySlug}/${r.slug}`}
                      className="hover:underline underline-offset-4"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    <>
                      {r.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        (outside the list)
                      </span>
                    </>
                  )}
                  <span className="font-normal text-muted-foreground"> · {r.foundry}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {state.status === "error" && (
        <p className="border-[0.5px] border-destructive/50 p-4 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}

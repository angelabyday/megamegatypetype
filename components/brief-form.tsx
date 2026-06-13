"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasSpecimen } from "@/components/typeface-card";

type ResultItem = {
  name: string;
  foundry: string;
  foundrySlug: string | null;
  slug: string | null;
  reason: string;
  outsideList: boolean;
};

type BriefQuestion = { question: string; options: string[] };

type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "questions"; questions: BriefQuestion[] }
  | { status: "results"; results: ResultItem[] }
  | { status: "error"; message: string };

const STORAGE_KEY = "brief-state";

export function BriefForm() {
  const [brief, setBrief] = useState("");
  const [state, setState] = useState<BriefState>({ status: "idle" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<(string | null)[]>([]);
  const restored = useRef(false);

  // Survive navigation to a result and back: state lives in sessionStorage.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
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
      }
    } catch {
      // Corrupt or absent saved state; start fresh.
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
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
        setSelectedOptions(new Array(data.questions.length).fill(null));
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
      {loading && (
        <div className="h-0.5 w-full overflow-hidden bg-border">
          <div className="h-full animate-brief-progress bg-foreground" />
        </div>
      )}
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
                question: q.question,
                answer: answers[i]?.trim() || "I don't know",
              }))
            );
          }}
          className="flex flex-col gap-6 rounded-md border-[0.5px] border-border p-4"
        >
          <p className="text-sm text-muted-foreground">
            A bit more detail would sharpen the matches. Skip anything you&rsquo;re not sure about.
          </p>
          {state.questions.map((q, i) => (
            <div key={q.question} className="flex flex-col gap-2">
              <p className="text-sm font-medium">{q.question}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      const nextSel = [...selectedOptions];
                      const nextAns = [...answers];
                      nextSel[i] = nextSel[i] === opt ? null : opt;
                      nextAns[i] = nextSel[i] === null ? "" : opt === "Other" ? "" : opt;
                      setSelectedOptions(nextSel);
                      setAnswers(nextAns);
                    }}
                    className={`rounded-full border-[0.5px] px-3 py-1 text-sm transition-colors ${
                      selectedOptions[i] === opt
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {(selectedOptions[i] === "Other" || (selectedOptions[i] === null)) && (
                <Input
                  value={selectedOptions[i] === "Other" ? (answers[i] ?? "") : (answers[i] ?? "")}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                    if (e.target.value && selectedOptions[i] !== "Other") {
                      const nextSel = [...selectedOptions];
                      nextSel[i] = null;
                      setSelectedOptions(nextSel);
                    }
                  }}
                  placeholder="Or type your own answer…"
                  className="mt-1"
                />
              )}
            </div>
          ))}
          <div>
            <Button type="submit" disabled={loading}>
              {loading ? "Matching…" : "Get matches"}
            </Button>
          </div>
        </form>
      )}

      {state.status === "results" && (
        <ol className="grid grid-cols-2 gap-4">
          {state.results.map((r, i) => {
            const specimen =
              r.slug && r.foundrySlug && hasSpecimen(r.foundrySlug, r.slug);
            const href = r.slug && r.foundrySlug
              ? `/t/${r.foundrySlug}/${r.slug}?from=brief`
              : null;
            return (
              <li
                key={`${r.foundry}/${r.name}`}
                className="rounded-[12px] border-[0.5px] border-border overflow-hidden"
              >
                {specimen && href && (
                  <Link href={href} className="block relative aspect-[16/10] w-full bg-muted">
                    <Image
                      src={`/specimens/${r.foundrySlug}/${r.slug}.webp`}
                      alt={`${r.name} specimen`}
                      fill
                      sizes="(min-width: 768px) 672px, 100vw"
                      className="object-cover"
                    />
                  </Link>
                )}
                <div className="flex gap-3 p-4">
                  <span className="text-sm text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div>
                    <div className="font-bold">
                      {href ? (
                        <Link href={href} className="hover:underline underline-offset-4">
                          {r.name}
                        </Link>
                      ) : (
                        <>{r.name} <span className="font-normal text-muted-foreground">(outside the list)</span></>
                      )}
                      <span className="font-normal text-muted-foreground"> · {r.foundry}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {state.status === "error" && (
        <p className="rounded-md border-[0.5px] border-destructive/50 p-4 text-sm text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}

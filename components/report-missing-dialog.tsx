"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportMissingButton({ foundryName }: { foundryName: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const overlayRef = useRef<HTMLDivElement>(null);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/submit-foundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), foundry: foundryName }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
      setUrl("");
    } catch {
      setStatus("error");
    }
  }

  function handleClose() {
    setOpen(false);
    setStatus("idle");
    setUrl("");
  }

  return (
    <>
      <p className="mt-3 text-xs text-muted-foreground">
        Have we missed a font or new release from this foundry?{" "}
        <button
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Let us know
        </button>
      </p>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border-[0.5px] border-border bg-background text-foreground p-6 shadow-xl mx-4">
            {status === "done" ? (
              <div className="text-center">
                <p className="text-sm">Reported. We&apos;ll take a look.</p>
                <Button className="mt-4" onClick={handleClose}>Close</Button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-medium mb-1">Report a missing typeface</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Paste the URL of the missing typeface from {foundryName} and we&apos;ll review it.
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    autoFocus
                    disabled={status === "submitting"}
                  />
                  {status === "error" && (
                    <p className="text-xs text-destructive">Something went wrong. Try again.</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={status === "submitting"}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={status === "submitting"}>
                      {status === "submitting" ? "Sending…" : "Submit"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

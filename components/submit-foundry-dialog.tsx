"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubmitFoundryButton() {
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
        body: JSON.stringify({ url: url.trim() }),
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
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-1.5 hover:opacity-75 transition-opacity"
      >
        Submit Foundry
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border-[0.5px] border-border bg-background p-6 shadow-xl mx-4">
            {status === "done" ? (
              <div className="text-center">
                <p className="text-sm">Submitted. We&apos;ll take a look.</p>
                <Button className="mt-4" onClick={handleClose}>Close</Button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-medium mb-1">Submit a foundry</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Paste the foundry&apos;s homepage URL and we&apos;ll review it for inclusion.
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <Input
                    type="url"
                    placeholder="https://example-foundry.com"
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

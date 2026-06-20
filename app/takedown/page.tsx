"use client";

import { useState } from "react";

export default function TakedownPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/takedown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        foundry: fd.get("foundry"),
        email: fd.get("email"),
        reason: fd.get("reason"),
      }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Takedown &amp; corrections</h1>
      <p className="text-sm text-muted-foreground mb-8">
        If you represent a foundry and want data removed or corrected, use this form. We&apos;ll respond within a few days.
      </p>

      {status === "sent" ? (
        <p className="text-sm">Request received — we&apos;ll be in touch.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="foundry">
              Foundry or typeface name <span className="text-destructive">*</span>
            </label>
            <input
              id="foundry"
              name="foundry"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              required
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              name="name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" htmlFor="email">
              Email for reply
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {status === "error" && (
            <p className="text-xs text-destructive">Something went wrong — please email us directly.</p>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send request"}
          </button>
        </form>
      )}
    </div>
  );
}

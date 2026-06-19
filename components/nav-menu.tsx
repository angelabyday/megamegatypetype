"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SubmitFoundryButton } from "@/components/submit-foundry-dialog";

const NAV_LINKS = [
  { href: "/foundries", label: "Foundries" },
  { href: "/brief", label: "Font Brief" },
  { href: "/wtf", label: "WTF is this font?" },
  { href: "/about", label: "About" },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden sm:flex items-center gap-4">
        <ThemeToggle />
        <nav className="flex items-center gap-0 rounded-full bg-foreground text-background text-sm overflow-hidden">
          {NAV_LINKS.map((link, i) => (
            <span key={link.href} className="contents">
              {i > 0 && <span className="w-px self-stretch bg-background/20" aria-hidden="true" />}
              <Link href={link.href} className="px-4 py-1.5 hover:opacity-75 transition-opacity">
                {link.label}
              </Link>
            </span>
          ))}
          <span className="w-px self-stretch bg-background/20" aria-hidden="true" />
          <SubmitFoundryButton />
        </nav>
      </div>

      {/* Mobile nav trigger */}
      <div className="flex items-center gap-2 sm:hidden">
        <ThemeToggle />
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-center rounded-full bg-foreground text-background p-2"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {open && (
        <div className="fixed inset-x-0 top-[var(--header-height,56px)] bottom-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 bg-background border-b border-border shadow-lg">
            <nav className="flex flex-col divide-y divide-border">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="px-6 py-4 text-sm hover:bg-muted transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="px-6 py-3">
                <SubmitFoundryButton />
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

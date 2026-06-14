import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { BackToTop } from "@/components/back-to-top";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://megamegatypetype.vercel.app"),
  title: {
    default: "MegaMegaTypeType",
    template: "%s · MegaMegaTypeType",
  },
  description:
    "A directory of 2,255 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
  openGraph: {
    title: "MegaMegaTypeType",
    description:
      "A directory of 2,255 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
    siteName: "MegaMegaTypeType",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MegaMegaTypeType",
    description:
      "A directory of 2,255 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: `(function(){var s=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(s===null&&d))document.documentElement.classList.add('dark');})()`}} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b-[0.5px] border-border">
          <div className="mx-auto flex items-center justify-between px-4 pt-3 pb-2 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              *MegaMegaTypeType*
            </Link>
            <div className="flex items-center gap-4">
            <ThemeToggle />
            <nav className="flex items-center gap-0 rounded-full bg-foreground text-background text-sm overflow-hidden">
              <Link href="/foundries" className="px-4 py-1.5 hover:opacity-75 transition-opacity">
                Foundries
              </Link>
              <span className="w-px self-stretch bg-background/20" aria-hidden="true" />
              <Link href="/brief" className="px-4 py-1.5 hover:opacity-75 transition-opacity">
                Font Brief
              </Link>
              <span className="w-px self-stretch bg-background/20" aria-hidden="true" />
              <Link href="/wtf" className="px-4 py-1.5 hover:opacity-75 transition-opacity">
                WTF is this font?
              </Link>
              <span className="w-px self-stretch bg-background/20" aria-hidden="true" />
              <Link href="/about" className="px-4 py-1.5 hover:opacity-75 transition-opacity">
                About
              </Link>
            </nav>
            </div>
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-6">
            The world&apos;s biggest index of typefaces from the world&apos;s best type foundries
          </p>
        </header>
        <main className="flex-1">{children}</main>
        <BackToTop />
        <footer className="border-t-[0.5px] border-border">
          <div className="mx-auto px-4 py-4 text-xs text-muted-foreground sm:px-6">
            Typeface data drawn from each foundry&apos;s own catalogue. All
            typefaces belong to their foundries. Not affiliated with any of
            them.
          </div>
        </footer>
      </body>
    </html>
  );
}

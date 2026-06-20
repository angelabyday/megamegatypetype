import type { Metadata } from "next";
import Link from "next/link";
import { NavMenu } from "@/components/nav-menu";
import { BackToTop } from "@/components/back-to-top";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.megamegatypetype.xyz"),
  title: {
    default: "MegaMegaTypeType",
    template: "%s · MegaMegaTypeType",
  },
  description:
    "On a mission to create the world's biggest index of typefaces from the world's best type foundries.",
  openGraph: {
    title: "MegaMegaTypeType",
    description:
      "On a mission to create the world's biggest index of typefaces from the world's best type foundries.",
    siteName: "MegaMegaTypeType",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MegaMegaTypeType",
    description:
      "On a mission to create the world's biggest index of typefaces from the world's best type foundries.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <header className="sticky top-0 z-30 bg-background border-b-[0.5px] border-border">
          <div className="mx-auto flex items-center justify-between px-4 pt-3 pb-2 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight">
              *MegaMegaTypeType*
            </Link>
            <NavMenu />
          </div>
          <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-6">
            On a mission to create the world&apos;s biggest index of typefaces from the world&apos;s best type foundries
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

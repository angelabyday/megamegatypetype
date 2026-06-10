import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://megamegatypetype.vercel.app"),
  title: {
    default: "MegaMegaTypeType",
    template: "%s · MegaMegaTypeType",
  },
  description:
    "A directory of 638 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
  openGraph: {
    title: "MegaMegaTypeType",
    description:
      "A directory of 638 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
    siteName: "MegaMegaTypeType",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MegaMegaTypeType",
    description:
      "A directory of 638 typefaces from independent foundries. Filter, search or describe your brief and get matches.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b-[0.5px] border-border">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-bold tracking-tight">
              MegaMegaTypeType
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/" className="hover:underline underline-offset-4">
                Directory
              </Link>
              <Link href="/brief" className="hover:underline underline-offset-4">
                Brief
              </Link>
              <Link href="/about" className="hover:underline underline-offset-4">
                About
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t-[0.5px] border-border">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
            Typeface data drawn from each foundry&apos;s own catalogue. All
            typefaces belong to their foundries. Not affiliated with any of
            them.
          </div>
        </footer>
      </body>
    </html>
  );
}

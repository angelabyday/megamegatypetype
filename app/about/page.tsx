import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "What MegaMegaTypeType is and where the data comes from.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">About</h1>
      <p className="mt-4 leading-relaxed">
        MegaMegaTypeType is a directory of typefaces from independent foundries,
        built by{" "}
        <a
          href="https://loveandlogic.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          Love &amp; Logic
        </a>
        . The index is drawn from the foundries&rsquo; own catalogues and we are
        not affiliated with any of them. Clicking through to a typeface takes
        you to the foundry&rsquo;s site, where their licence terms apply.
      </p>
    </div>
  );
}

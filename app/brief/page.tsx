import type { Metadata } from "next";
import { BriefForm } from "@/components/brief-form";

export const metadata: Metadata = {
  title: "Brief mode",
  description:
    "Describe your project and get 10 ranked typeface matches from the directory.",
};

export default function BriefPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">Brief mode</h1>
      <p className="mt-2 mb-6 text-muted-foreground">
        Describe the project: sector, mood, references, what to avoid. You get
        10 ranked matches from the directory with a one-line reason each.
      </p>
      <BriefForm />
    </div>
  );
}

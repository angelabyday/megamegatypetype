import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Not found</h1>
      <p className="text-muted-foreground">
        No typeface, foundry or page lives at this address.
      </p>
      <Button asChild>
        <Link href="/">Back to the directory</Link>
      </Button>
    </div>
  );
}

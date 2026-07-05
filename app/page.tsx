import { Directory } from "@/components/directory";
import { getAllTypefaces, getFoundries, toDirectoryEntry } from "@/lib/typefaces";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const params = await searchParams;
  const typefaces = getAllTypefaces().map(toDirectoryEntry);
  return <Directory typefaces={typefaces} foundries={getFoundries()} initialParams={params} />;
}

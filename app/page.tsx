import { Directory } from "@/components/directory";
import { getAllTypefaces, getFoundries, toDirectoryEntry } from "@/lib/typefaces";

export default function Home() {
  const typefaces = getAllTypefaces().map(toDirectoryEntry);
  return <Directory typefaces={typefaces} foundries={getFoundries()} />;
}

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const foldersResult = await sql`
    SELECT id, name, position FROM folders
    WHERE user_id = ${userId}
    ORDER BY position ASC, created_at ASC
  `;

  const folderIds: number[] = foldersResult.rows.map((f) => f.id as number);

  let fontsByFolder: Record<number, { foundrySlug: string; typefaceSlug: string }[]> = {};
  if (folderIds.length > 0) {
    const fontsResult = await sql.query(
      "SELECT folder_id, foundry_slug, typeface_slug FROM folder_fonts WHERE folder_id = ANY($1::int[]) ORDER BY position ASC, created_at ASC",
      [folderIds]
    );
    for (const row of fontsResult.rows) {
      if (!fontsByFolder[row.folder_id]) fontsByFolder[row.folder_id] = [];
      fontsByFolder[row.folder_id].push({
        foundrySlug: row.foundry_slug,
        typefaceSlug: row.typeface_slug,
      });
    }
  }

  const folders = foldersResult.rows.map((f) => ({
    id: f.id,
    name: f.name,
    position: f.position,
    fonts: fontsByFolder[f.id] ?? [],
  }));

  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const countResult = await sql`SELECT COUNT(*) FROM folders WHERE user_id = ${userId}`;
  const position = Number(countResult.rows[0].count);

  const result = await sql`
    INSERT INTO folders (user_id, name, position)
    VALUES (${userId}, ${name.trim()}, ${position})
    RETURNING id, name, position
  `;

  return NextResponse.json({ folder: { ...result.rows[0], fonts: [] } }, { status: 201 });
}

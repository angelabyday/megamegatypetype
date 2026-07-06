import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = parseInt(id);
  const { foundrySlug, typefaceSlug } = await req.json();
  if (!foundrySlug || !typefaceSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ownerCheck = await sql`SELECT id FROM folders WHERE id = ${folderId} AND user_id = ${userId}`;
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const posResult = await sql`
    SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM folder_fonts WHERE folder_id = ${folderId}
  `;
  const position = posResult.rows[0].pos as number;

  await sql`
    INSERT INTO folder_fonts (folder_id, foundry_slug, typeface_slug, position)
    VALUES (${folderId}, ${foundrySlug}, ${typefaceSlug}, ${position})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = parseInt(id);
  const { orderedItems } = await req.json() as { orderedItems: { foundrySlug: string; typefaceSlug: string }[] };

  const ownerCheck = await sql`SELECT id FROM folders WHERE id = ${folderId} AND user_id = ${userId}`;
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await Promise.all(
    orderedItems.map(({ foundrySlug, typefaceSlug }, i) =>
      sql`UPDATE folder_fonts SET position = ${i} WHERE folder_id = ${folderId} AND foundry_slug = ${foundrySlug} AND typeface_slug = ${typefaceSlug}`
    )
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = parseInt(id);
  const { foundrySlug, typefaceSlug } = await req.json();

  const ownerCheck = await sql`SELECT id FROM folders WHERE id = ${folderId} AND user_id = ${userId}`;
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await sql`
    DELETE FROM folder_fonts
    WHERE folder_id = ${folderId} AND foundry_slug = ${foundrySlug} AND typeface_slug = ${typefaceSlug}
  `;
  return NextResponse.json({ ok: true });
}

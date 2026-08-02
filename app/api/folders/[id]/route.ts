import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = parseInt(id);
  if (isNaN(folderId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json();

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (name.length > 100) return NextResponse.json({ error: "Name too long" }, { status: 400 });
    await sql`
      UPDATE folders SET name = ${name}
      WHERE id = ${folderId} AND user_id = ${userId}
    `;
  }

  if (body.position !== undefined) {
    if (typeof body.position !== "number" || !Number.isInteger(body.position) || body.position < 0) {
      return NextResponse.json({ error: "Invalid position" }, { status: 400 });
    }
    await sql`
      UPDATE folders SET position = ${body.position}
      WHERE id = ${folderId} AND user_id = ${userId}
    `;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folderId = parseInt(id);
  if (isNaN(folderId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await sql`DELETE FROM folders WHERE id = ${folderId} AND user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}

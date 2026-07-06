import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sql`
    SELECT foundry_slug, typeface_slug FROM liked_fonts
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({
    liked: result.rows.map((r) => ({
      foundrySlug: r.foundry_slug,
      typefaceSlug: r.typeface_slug,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { foundrySlug, typefaceSlug } = await req.json();
  if (!foundrySlug || !typefaceSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id FROM liked_fonts
    WHERE user_id = ${userId} AND foundry_slug = ${foundrySlug} AND typeface_slug = ${typefaceSlug}
  `;

  if (existing.rows.length > 0) {
    await sql`
      DELETE FROM liked_fonts
      WHERE user_id = ${userId} AND foundry_slug = ${foundrySlug} AND typeface_slug = ${typefaceSlug}
    `;
    return NextResponse.json({ liked: false });
  } else {
      await sql`
      INSERT INTO liked_fonts (user_id, foundry_slug, typeface_slug)
      VALUES (${userId}, ${foundrySlug}, ${typefaceSlug})
    `;
    return NextResponse.json({ liked: true });
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderedItems } = await req.json() as { orderedItems: { foundrySlug: string; typefaceSlug: string }[] };

  await Promise.all(
    orderedItems.map(({ foundrySlug, typefaceSlug }, i) =>
      sql`UPDATE liked_fonts SET position = ${i} WHERE user_id = ${userId} AND foundry_slug = ${foundrySlug} AND typeface_slug = ${typefaceSlug}`
    )
  );

  return NextResponse.json({ ok: true });
}

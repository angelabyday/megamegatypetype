import { sql } from "@vercel/postgres";

async function main() {
  await sql`ALTER TABLE liked_fonts ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0`;
  await sql`ALTER TABLE folder_fonts ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0`;

  // Set initial positions from insertion order
  await sql`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) - 1 AS pos
      FROM liked_fonts
    )
    UPDATE liked_fonts SET position = numbered.pos
    FROM numbered WHERE liked_fonts.id = numbered.id
  `;
  await sql`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at) - 1 AS pos
      FROM folder_fonts
    )
    UPDATE folder_fonts SET position = numbered.pos
    FROM numbered WHERE folder_fonts.id = numbered.id
  `;

  console.log("Migration 2 complete — position columns added.");
}

main().catch(console.error);

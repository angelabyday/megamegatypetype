import { sql } from "@vercel/postgres";

await sql`
  CREATE TABLE IF NOT EXISTS liked_fonts (
    id            SERIAL PRIMARY KEY,
    user_id       TEXT NOT NULL,
    foundry_slug  TEXT NOT NULL,
    typeface_slug TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, foundry_slug, typeface_slug)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS folders (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    position   INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS folder_fonts (
    id            SERIAL PRIMARY KEY,
    folder_id     INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    foundry_slug  TEXT NOT NULL,
    typeface_slug TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (folder_id, foundry_slug, typeface_slug)
  )
`;

await sql`CREATE INDEX IF NOT EXISTS liked_fonts_user_idx ON liked_fonts(user_id)`;
await sql`CREATE INDEX IF NOT EXISTS folders_user_idx ON folders(user_id)`;
await sql`CREATE INDEX IF NOT EXISTS folder_fonts_folder_idx ON folder_fonts(folder_id)`;

console.log("Migration complete.");
process.exit(0);

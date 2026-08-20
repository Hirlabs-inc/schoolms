// scripts/migrate-postgres.mjs
//
// Applies scripts/schema.postgres.sql to a local Postgres database.
//
// Usage (env must provide DATABASE_URL):
//   node scripts/migrate-postgres.mjs
//   # or: npm run db:migrate
//
// Idempotent: every statement uses "create table if not exists".

import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(__dirname, "schema.postgres.sql")
const schema = await readFile(schemaPath, "utf8")

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query("BEGIN")
  await client.query(schema)
  await client.query("COMMIT")
  const tables = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename"
  )
  console.log("Postgres schema applied.")
  console.log("Tables:", tables.rows.map((r) => r.tablename).join(", "))
} catch (e) {
  await client.query("ROLLBACK")
  console.error("FAILED:", e.message)
  process.exit(1)
} finally {
  await client.end()
}
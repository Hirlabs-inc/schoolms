import "server-only"
import { createClient } from "@libsql/client/web"
import { createPgExecutor, type DbExecutor } from "./pg-adapter"

const url = process.env.TURSO_URL
const authToken = process.env.TURSO_TOKEN
const usingPostgres = !!process.env.DATABASE_URL

if (!usingPostgres && (!url || !authToken)) {
  throw new Error("Missing database config (set DATABASE_URL for Postgres, or TURSO_URL / TURSO_TOKEN for Turso)")
}

// Server-only database client. Never import this from a client component.
//
// When DATABASE_URL is set (e.g. a locally hosted Postgres) we use a small
// adapter that mirrors the libsql client surface used by the app (execute +
// batch) and rewrites the app's SQLite-flavoured SQL to Postgres. Otherwise the
// original libsql/Turso client is used, unchanged.
export const turso: DbExecutor = usingPostgres
  ? createPgExecutor(process.env.DATABASE_URL as string)
  : (createClient({ url: url as string, authToken: authToken as string }) as unknown as DbExecutor)
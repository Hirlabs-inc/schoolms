import "server-only"
import { createClient } from "@libsql/client/web"

const url = process.env.TURSO_URL
const authToken = process.env.TURSO_TOKEN

if (!url || !authToken) {
  throw new Error("Missing Turso environment variables (TURSO_URL / TURSO_TOKEN)")
}

// Server-only database client. Never import this from a client component.
export const turso = createClient({ url, authToken })

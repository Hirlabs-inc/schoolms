// Client-safe database proxy. Does NOT import the server turso client or any
// secrets. All queries go through the server-side /api/db route handler, which
// holds the DB token and verifies the user's JWT.
import { getStoredToken } from "./auth-client"

export interface ResultSet {
  rows: any[]
}

// Accepts the same call shapes as the libSQL client:
//   execute("select ...")                 -> string form
//   execute({ sql, args })                -> object form
async function execute(
  query: string | { sql: string; args?: any[] }
): Promise<ResultSet> {
  const sql = typeof query === "string" ? query : query.sql
  const args = typeof query === "string" ? [] : query.args ?? []

  const token = getStoredToken()
  const res = await fetch("/api/db", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sql, args }),
  })
  if (!res.ok) {
    let msg = "Database request failed"
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  return { rows: data.rows ?? [] }
}

// Shape-compatible replacement for the server `turso` client used by lib/api.ts.
export const turso = {
  execute,
}

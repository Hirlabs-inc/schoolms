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

// Run several statements in a single HTTP round trip. This is what fixes the
// "one query per row" (N+1) pattern that made every page load slowly.
async function batch(
  queries: Array<{ sql: string; args?: any[] }>
): Promise<ResultSet[]> {
  const token = getStoredToken()
  const res = await fetch("/api/db", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ queries }),
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
  return (data.results ?? []).map((r: { rows?: any[] }) => ({
    rows: r.rows ?? [],
  }))
}

// Shape-compatible replacement for the server `turso` client used by lib/api.ts.
export const turso = {
  execute,
  batch,
}

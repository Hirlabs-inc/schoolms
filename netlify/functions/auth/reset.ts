// Netlify Function: /api/auth/reset  (POST { email, newPassword })
// Resets a user's password (hashes server-side). Mirrors app/api/auth/reset/route.ts.
import { turso } from "../../../lib/turso"
import { verifyToken, hashPassword } from "../../../lib/auth"

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } })
  }
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const actor = token ? await verifyToken(token) : null
  if (!actor) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  let body: { email?: string; newPassword?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  const email = (body.email ?? "").trim().toLowerCase()
  const newPassword = body.newPassword ?? ""
  if (!email || !newPassword || newPassword.length < 6) {
    return new Response(JSON.stringify({ error: "Email and a password (>=6 chars) are required" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  // Only ADMIN (or the user themselves) may reset.
  if (actor.role !== "ADMIN" && actor.email !== email) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } })
  }
  const hashed = await hashPassword(newPassword)
  const rs = await turso.execute({ sql: "update profiles set password = ? where email = ?", args: [hashed, email] })
  if ((rs as any).rowsAffected === 0) {
    return new Response(JSON.stringify({ error: "No user found with that email" }), { status: 404, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })
}

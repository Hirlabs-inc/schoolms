// Netlify Function: /api/auth/me  (GET) — returns the session user from the JWT.
import { verifyToken } from "../../../lib/auth"

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } })
  }
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ user }), { status: 200, headers: { "Content-Type": "application/json" } })
}

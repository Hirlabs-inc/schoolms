import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { createStaffUser, HttpError } from "@/lib/user-admin"

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  const actor = token ? await verifyToken(token) : null
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const result = await createStaffUser(actor, body)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("admin create user failed:", e)
    return NextResponse.json({ error: "Unexpected error creating user" }, { status: 500 })
  }
}
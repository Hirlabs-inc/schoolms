import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { deleteStaffUser, updateStaffUser, HttpError } from "@/lib/user-admin"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  const actor = token ? await verifyToken(token) : null
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    const result = await updateStaffUser(actor, id, body)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("admin update user failed:", e)
    return NextResponse.json({ error: "Unexpected error updating user" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  const actor = token ? await verifyToken(token) : null
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "MANAGER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const result = await deleteStaffUser(actor, id)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error("admin delete user failed:", e)
    return NextResponse.json({ error: "Unexpected error deleting user" }, { status: 500 })
  }
}
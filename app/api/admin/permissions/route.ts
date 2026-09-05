/**
 * GET  /api/admin/permissions   — list all role/permission grants
 * POST /api/admin/permissions   — bulk upsert (replaces specific grants)
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { ALL_PERMISSIONS, getAllRolePermissions, setRolePermission } from "@/lib/permissions"
import type { Permission } from "@/lib/permissions"
import type { UserRole } from "@/lib/types"

function isAllowedRole(v: string): v is UserRole {
  return ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"].includes(v)
}

async function getActor(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  return token ? await verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const actor = await getActor(req)
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const rows = await getAllRolePermissions()
  return NextResponse.json({ permissions: rows })
}

export async function POST(req: NextRequest) {
  const actor = await getActor(req)
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: Array<{ role: UserRole; permission: string; granted: boolean }> =
    body.updates || body || []

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "updates must be an array" }, { status: 400 })
  }

  for (const u of updates) {
    if (!isAllowedRole(u.role)) {
      return NextResponse.json({ error: `Invalid role: ${u.role}` }, { status: 400 })
    }
    if (
      typeof u.permission !== "string" ||
      !ALL_PERMISSIONS.some((p) => p.key === u.permission)
    ) {
      return NextResponse.json({ error: `Invalid permission: ${u.permission}` }, { status: 400 })
    }
    await setRolePermission(u.role as UserRole, u.permission as Permission, Boolean(u.granted))
  }

  return NextResponse.json({ success: true })
}

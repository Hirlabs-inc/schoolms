import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { getRolePermissions } from "@/lib/permissions"
import type { UserRole } from "@/lib/types"

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  const actor = token ? await verifyToken(token) : null
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = actor.role as UserRole
  const perms = await getRolePermissions(role)

  return NextResponse.json({
    role,
    permissions: Array.from(perms),
  })
}

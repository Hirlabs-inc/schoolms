/**
 * GET    /api/admin/permissions/[role]   — list grants for one role
 * PATCH  /api/admin/permissions/[role]  — toggle a single permission
 * DELETE /api/admin/permissions/[role]  — reset a role to defaults
 */
import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth"
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, setRolePermission, resetRolePermissions } from "@/lib/permissions"
import type { Permission } from "@/lib/permissions"
import type { UserRole } from "@/lib/types"
import { turso } from "@/lib/turso"

function isAllowedRole(v: string): v is UserRole {
  return ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"].includes(v)
}

async function getActor(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null
  return token ? await verifyToken(token) : null
}

interface Ctx {
  params: Promise<{ role: string }>
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const actor = await getActor(req)
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { role } = await params
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  const defaults = DEFAULT_ROLE_PERMISSIONS[role as UserRole]
  const rs = await turso.execute({
    sql: "select permission, granted from role_permissions where role = ?",
    args: [role],
  })
  const overrides = new Map<string, boolean>()
  for (const row of rs.rows as Array<{ permission: string; granted: boolean | number }>) {
    overrides.set(row.permission, Boolean(row.granted))
  }

  const perms = ALL_PERMISSIONS.map((p) => ({
    permission: p.key,
    label: p.label,
    group: p.group,
    granted: overrides.has(p.key)
      ? overrides.get(p.key)!
      : defaults[p.key as keyof typeof defaults] ?? false,
  }))

  return NextResponse.json({ role, permissions: perms })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const actor = await getActor(req)
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { role } = await params
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (
    typeof body.permission !== "string" ||
    !ALL_PERMISSIONS.some((p) => p.key === body.permission)
  ) {
    return NextResponse.json(
      { error: `Invalid or unknown permission: ${body.permission}` },
      { status: 400 }
    )
  }
  if (typeof body.granted !== "boolean") {
    return NextResponse.json({ error: "granted must be boolean" }, { status: 400 })
  }

  await setRolePermission(role as UserRole, body.permission as Permission, body.granted)
  return NextResponse.json({
    success: true,
    role,
    permission: body.permission,
    granted: body.granted,
  })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const actor = await getActor(req)
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { role } = await params
  if (!isAllowedRole(role)) {
    return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 })
  }

  await resetRolePermissions(role as UserRole)
  return NextResponse.json({
    success: true,
    role,
    message: `Permissions for ${role} reset to defaults`,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, sessionCookieOptions, isSameOrigin } from "@/lib/auth"

// POST /api/auth/logout — clears the httpOnly session cookie.
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 })
  return res
}

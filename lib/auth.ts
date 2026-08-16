import "server-only"
import { SignJWT, jwtVerify, decodeJwt } from "jose"
import bcrypt from "bcryptjs"

const SECRET_VALUE = process.env.JWT_SECRET
if (process.env.NODE_ENV === "production" && !SECRET_VALUE) {
  throw new Error("FATAL: JWT_SECRET environment variable is required in production")
}
const SECRET_KEY = new TextEncoder().encode(
  SECRET_VALUE || "trainify-dev-insecure-secret-do-not-use-in-production"
)

export interface SessionUser {
  id: string
  email: string
  role: "ADMIN" | "TEACHER" | "STUDENT" | "SECRETARY" | "MANAGER"
  firstName: string
  lastName: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Server-side: signs a token using the SECRET JWT_SECRET (never exposed to client).
export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ sub: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY)
}

// Server-side: verifies a token's signature using the secret.
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as SessionUser["role"],
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
    }
  } catch {
    return null
  }
}

// Client-safe: decodes WITHOUT verifying the signature. Use ONLY for UI routing
// (e.g. picking a dashboard). Never trust this for authorization — the server
// re-verifies on every /api/* call.
export function decodeTokenUnsafe(token: string): SessionUser | null {
  try {
    const payload = decodeJwt(token)
    return {
      id: payload.sub as string,
      email: payload.email as string,
      role: payload.role as SessionUser["role"],
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
    }
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth_token")
}

export function setStoredToken(token: string) {
  localStorage.setItem("auth_token", token)
}

export function clearStoredToken() {
  localStorage.removeItem("auth_token")
  localStorage.removeItem("currentUser")
}

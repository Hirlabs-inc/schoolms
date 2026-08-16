// Client-safe auth helpers (NO server-only import, NO secrets).
// Use this from client components/pages instead of lib/auth.ts.

import bcrypt from "bcryptjs"

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
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

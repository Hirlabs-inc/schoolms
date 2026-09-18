import { describe, it, expect, afterEach } from "vitest"
import * as auth from "../auth"

describe("auth JWT secret resolution is lazy", () => {
  const prevSecret = process.env.JWT_SECRET
  const prevEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.JWT_SECRET = prevSecret
    ;(process.env as any).NODE_ENV = prevEnv
  })

  it("does not throw at import time without JWT_SECRET in production", async () => {
    delete process.env.JWT_SECRET
    ;(process.env as any).NODE_ENV = "production"
    // Importing the module must not throw (this is what broke `next build`).
    const mod = await import("../auth")
    expect(typeof mod.createToken).toBe("function")
  })

  it("throws when signing/verifying without JWT_SECRET in production", async () => {
    delete process.env.JWT_SECRET
    ;(process.env as any).NODE_ENV = "production"
    await expect(
      auth.createToken({ id: "1", email: "a@b.c", role: "ADMIN", firstName: "A", lastName: "B" })
    ).rejects.toThrow(/JWT_SECRET/)
    await expect(auth.verifyToken("whatever")).resolves.toBeNull()
  })
})

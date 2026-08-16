import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { resetDb } from "../../vitest.setup"

describe("SMS Integration", () => {
  let origFetch: typeof globalThis.fetch
  let origKey: string | undefined

  beforeEach(() => {
    resetDb()
    origFetch = globalThis.fetch
    origKey = process.env.NEXT_PUBLIC_TEXTBEE_API_KEY
  })

  afterEach(() => {
    globalThis.fetch = origFetch
    if (origKey !== undefined) {
      process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = origKey
    }
  })

  it("sendSMS function exists and is callable", async () => {
    const sms = await import("../sms")
    expect(typeof sms.sendSMS).toBe("function")
  })

  it("sendSMS returns false when device fetch fails", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server error",
    }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const result = await sms.sendSMS("+254700000000", "Test")
    expect(result).toBe(false)
  })

  it("sendSMS returns false when no device found", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const result = await sms.sendSMS("+254700000000", "Test")
    expect(result).toBe(false)
  })

  it("sendSMS returns true on successful send", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ _id: "device-1" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const result = await sms.sendSMS("+254700000000", "Your child is absent today")
    expect(result).toBe(true)
  })

  it("sendSMS sends correct recipients and message", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    let capturedBody: any = null
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ _id: "device-1" }] }),
      })
      .mockImplementationOnce(async (_url: string, init: any) => {
        capturedBody = JSON.parse(init.body)
        return { ok: true, json: async () => ({ success: true }) }
      }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const message = "Attendance Alert: John Doe was marked ABSENT on 2026-01-15 for Mathematics"
    await sms.sendSMS("+254700000000", message)
    expect(capturedBody.recipients).toContain("+254700000000")
    expect(capturedBody.message).toContain("ABSENT")
  })

  it("sendSMS formats fee reminder message correctly", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    let capturedBody: any = null
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ _id: "device-1" }] }),
      })
      .mockImplementationOnce(async (_url: string, init: any) => {
        capturedBody = JSON.parse(init.body)
        return { ok: true, json: async () => ({ success: true }) }
      }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const message = "Fee Reminder: Outstanding balance of KES 15,000 for John Doe. Please pay by 2026-02-28"
    await sms.sendSMS("+254700000000", message)
    expect(capturedBody.message).toContain("Fee Reminder")
    expect(capturedBody.message).toContain("15,000")
  })

  it("sendSMS handles network error gracefully", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any

    vi.resetModules()
    const sms = await import("../sms")
    const result = await sms.sendSMS("+254700000000", "Test")
    expect(result).toBe(false)
  })

  it("sendSMS sends API key in headers", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "my-secret-key"

    let capturedHeaders: any = null
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(async (_url: string, init: any) => {
        capturedHeaders = init?.headers
        return { ok: true, json: async () => ({ data: [{ _id: "device-1" }] }) }
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) as any

    vi.resetModules()
    const sms = await import("../sms")
    await sms.sendSMS("+254700000000", "Test")
    expect(capturedHeaders["x-api-key"]).toBe("my-secret-key")
  })

  it("sendSMS returns false when send endpoint fails", async () => {
    process.env.NEXT_PUBLIC_TEXTBEE_API_KEY = "test-key"

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ _id: "device-1" }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      }) as any

    vi.resetModules()
    const sms = await import("../sms")
    const result = await sms.sendSMS("+254700000000", "Test")
    expect(result).toBe(false)
  })
})

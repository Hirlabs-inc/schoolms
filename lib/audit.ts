import "server-only"
import { turso } from "./turso"
import type { SessionUser } from "./auth"

// Append-only audit trail for security-relevant actions. Best-effort: a failure
// to write must never break the request that triggered it.
export async function logAudit(
  actor: SessionUser | null | undefined,
  action: string,
  opts: { targetType?: string; targetId?: string | null; details?: unknown } = {}
): Promise<void> {
  try {
    await turso.execute({
      sql: "insert into audit_log (id, actorid, actorrole, action, targettype, targetid, details, createdat) values (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        crypto.randomUUID(),
        actor?.id ?? null,
        actor?.role ?? null,
        action,
        opts.targetType ?? null,
        opts.targetId ?? null,
        opts.details !== undefined ? JSON.stringify(opts.details) : null,
        new Date().toISOString(),
      ],
    })
  } catch {
    // ignore — auditing is not allowed to break the request
  }
}

/**
 * Seed default role_permissions into the database.
 *
 * Run with:  node scripts/seed-role-permissions.js
 * Env: DATABASE_URL or TURSO_URL + TURSO_TOKEN
 *
 * Creates a single row per (role, permission) with granted=true for ADMIN
 * and the role-appropriate default for each other role. Safe to re-run
 * (upserts). Idempotent.
 */
import { turso } from "../lib/turso"
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions"
import type { UserRole } from "../lib/types"

const ROLES: UserRole[] = ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"]

async function main() {
  let count = 0
  for (const role of ROLES) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role as UserRole]
    for (const p of ALL_PERMISSIONS) {
      const key = p.key
      const granted = defaults[key] ?? false
      await turso.execute({
        sql: "insert into role_permissions (role, permission, granted) values (?, ?, ?) on conflict (role, permission) do update set granted = excluded.granted",
        args: [role, key, granted ? 1 : 0],
      })
      count++
    }
  }
  console.log(`Seeded ${count} role_permissions rows`)
}

main()
  .then(() => { console.log("✔ role_permissions seeded"); process.exit(0) })
  .catch((e) => { console.error("FAILED:", e); process.exit(1) })

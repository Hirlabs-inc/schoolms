// scripts/fix-students-fk.mjs
//
// Idempotent guard: removes the `students.id -> profiles(id)` foreign key.
//
// The `students` table was originally created with
//   id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE
// which forces every student row to have a matching `profiles` row. But the
// app registers students WITHOUT creating a login profile (login is optional),
// so non-login student inserts fail with:
//   SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
//
// This script rebuilds `students` without that FK (keeping the legitimate
// nullable FKs: profileId, classId, courseId). Safe to run any number of
// times — if the FK is already gone it is a no-op.
//
// Usage (env must provide TURSO_URL + TURSO_TOKEN):
//   node scripts/fix-students-fk.mjs
//   # or: npm run db:fix-students-fk

import { createClient } from "@libsql/client"

const url = process.env.TURSO_URL
const authToken = process.env.TURSO_TOKEN

if (!url || !authToken) {
  console.error("Missing TURSO_URL / TURSO_TOKEN environment variables")
  process.exit(1)
}

const client = createClient({ url, authToken })

const NEW_DDL = `CREATE TABLE students (
  id text primary key,
  studentNumber text not null,
  enrollmentYear integer not null,
  classId text references classes(id),
  academicYear integer not null,
  parentPhone text,
  phone text,
  gender text,
  courseId text references courses(id),
  admissionDate text,
  expectedCompletionDate text,
  status text default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','DROPPED')),
  createdAt text default (datetime('now')),
  profileId TEXT REFERENCES profiles(id),
  email TEXT
)`

async function main() {
  const fk = await client.execute({ sql: "PRAGMA foreign_key_list(students)" })
  const hasIdFk = fk.rows.some((r) => r.from === "id")

  if (!hasIdFk) {
    console.log("OK: students.id -> profiles(id) FK already removed. Nothing to do.")
    return
  }

  console.log("Found students.id -> profiles(id) FK. Rebuilding table without it...")

  await client.execute({ sql: "PRAGMA foreign_keys=OFF" })
  await client.execute({ sql: "DROP TABLE IF EXISTS students_old" })
  await client.execute({ sql: "ALTER TABLE students RENAME TO students_old" })
  await client.execute({ sql: NEW_DDL })
  await client.execute({ sql: "INSERT INTO students SELECT * FROM students_old" })
  await client.execute({ sql: "DROP TABLE students_old" })
  await client.execute({ sql: "PRAGMA foreign_keys=ON" })

  const after = await client.execute({ sql: "PRAGMA foreign_key_list(students)" })
  const stillThere = after.rows.some((r) => r.from === "id")
  if (stillThere) {
    throw new Error("FK still present after rebuild — aborting")
  }
  const cnt = await client.execute({ sql: "SELECT count(*) as n FROM students" })
  console.log(`Done. students.id FK removed; ${cnt.rows[0].n} row(s) preserved.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e.message)
    process.exit(1)
  })

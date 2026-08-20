// Server-only Postgres adapter helpers for lib/turso.ts.
//
// Mirrors the libsql client surface the app uses (execute + batch) and rewrites
// the app's SQLite-flavoured SQL to Postgres:
//   - "?" placeholders -> $1, $2, ...  (outside string literals)
//   - quoted camelCase identifiers ("studentId") -> lowercase (studentid)
//   - "insert or ignore into" -> "insert into ... on conflict do nothing"
//   - "insert or replace into" -> upsert via "on conflict (id) do update ..."
// Postgres folds unquoted identifiers to lowercase, so unquoted camelCase
// column names in queries keep working against the lowercase schema. Result
// keys are remapped back to the camelCase the rest of the app expects.

import pg from "pg"

export type DbRow = Record<string, any>
export interface DbResult {
  rows: DbRow[]
}
export interface DbQuery {
  sql: string
  args?: any[]
}
export interface DbExecutor {
  execute(stmt: string | DbQuery): Promise<DbResult>
  batch(queries: DbQuery[]): Promise<DbResult[]>
}

// Lowercase (postgres) column/alias -> camelCase key used by the app.
export const CAMEL: Record<string, string> = {
  firstname: "firstName",
  lastname: "lastName",
  resettoken: "resetToken",
  resettokenexpiry: "resetTokenExpiry",
  createdat: "createdAt",
  updatedat: "updatedAt",
  studentnumber: "studentNumber",
  enrollmentyear: "enrollmentYear",
  classid: "classId",
  academicyear: "academicYear",
  parentphone: "parentPhone",
  courseid: "courseId",
  admissiondate: "admissionDate",
  expectedcompletiondate: "expectedCompletionDate",
  profileid: "profileId",
  staffid: "staffId",
  gradelevel: "gradeLevel",
  teacherid: "teacherId",
  commissionrate: "commissionRate",
  totalmarks: "totalMarks",
  examid: "examId",
  studentid: "studentId",
  marksobtained: "marksObtained",
  totalfee: "totalFee",
  duedate: "dueDate",
  feeid: "feeId",
  paymentdate: "paymentDate",
  paymentmethod: "paymentMethod",
  receiptnumber: "receiptNumber",
  createdby: "createdBy",
  expensedate: "expenseDate",
  incomedate: "incomeDate",
  compensationtype: "compensationType",
  commissionperstudent: "commissionPerStudent",
  salaryamount: "salaryAmount",
  bankname: "bankName",
  bankaccount: "bankAccount",
  bankcode: "bankCode",
  taxid: "taxId",
  startdate: "startDate",
  enddate: "endDate",
  contractid: "contractId",
  periodstart: "periodStart",
  periodend: "periodEnd",
  paydate: "payDate",
  paytype: "payType",
  progresspercent: "progressPercent",
  completiondate: "completionDate",
  commissionamount: "commissionAmount",
  paidamount: "paidAmount",
  receiptheader: "receiptHeader",
  contactemail: "contactEmail",
  contactphone: "contactPhone",
  totalpayroll: "totalPayroll",
  paycount: "payCount",
  avgpct: "avgPct",
}

export function toCamel(key: string): string {
  if (CAMEL[key]) return CAMEL[key]
  if (key.includes("_")) return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
  return key
}

export function mapRow(row: Record<string, any>): DbRow {
  const out: DbRow = {}
  for (const k of Object.keys(row)) out[toCamel(k)] = row[k]
  return out
}

export function toPostgresSql(sql: string): string {
  let out = sql
  let conflictSuffix = ""

  if (/^\s*insert\s+or\s+ignore\s+into/i.test(out)) {
    out = out.replace(/^\s*insert\s+or\s+ignore\s+into/i, "insert into")
    conflictSuffix = " on conflict do nothing"
  } else if (/^\s*insert\s+or\s+replace\s+into/i.test(out)) {
    out = out.replace(/^\s*insert\s+or\s+replace\s+into/i, "insert into")
    const colsMatch = out.match(/^insert\s+into\s+[a-z_0-9]+\s*\(([^)]*)\)/i)
    const cols = (colsMatch?.[1] ?? "")
      .split(",")
      .map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase())
      .filter(Boolean)
    const pk = cols.includes("id") ? "id" : (cols[0] ?? "id")
    const setCols = cols.filter((c) => c !== pk)
    conflictSuffix = setCols.length
      ? ` on conflict (${pk}) do update set ${setCols.map((c) => `${c} = excluded.${c}`).join(", ")}`
      : " on conflict do nothing"
  }

  // "?" -> $N and lowercase double-quoted identifiers, skipping string literals.
  let result = ""
  let i = 0
  let n = 0
  let inStr = false
  while (i < out.length) {
    const ch = out[i]
    if (inStr) {
      if (ch === "'") {
        if (out[i + 1] === "'") {
          result += "''"
          i += 2
          continue
        }
        inStr = false
      }
      result += ch
      i++
      continue
    }
    if (ch === "'") {
      inStr = true
      result += ch
      i++
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < out.length && out[j] !== '"') j++
      result += out.slice(i + 1, j).toLowerCase()
      i = j + 1
      continue
    }
    if (ch === "?") {
      n++
      result += `$${n}`
      i++
      continue
    }
    result += ch
    i++
  }

  return result + conflictSuffix
}

// Normalise the pg numeric types to JS numbers (like libsql returns).
// pg returns int8/numeric as strings by default, which would break
// count(*)/sum(...) callers that do `rows[0].totalPayroll || 0`.
pg.types.setTypeParser(20, (v) => (v === null ? v : parseInt(v, 10))) // int8
pg.types.setTypeParser(23, (v) => (v === null ? v : parseInt(v, 10))) // int4
pg.types.setTypeParser(26, (v) => (v === null ? v : parseInt(v, 10))) // oid
pg.types.setTypeParser(700, (v) => (v === null ? v : parseFloat(v))) // float4
pg.types.setTypeParser(701, (v) => (v === null ? v : parseFloat(v))) // float8
pg.types.setTypeParser(1700, (v) => (v === null ? v : parseFloat(v))) // numeric

let pool: pg.Pool | null = null
export function getPool(connectionString: string): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString })
  }
  return pool
}

function normalizeQuery(stmt: string | DbQuery): { text: string; values: any[] } {
  if (typeof stmt === "string") {
    return { text: toPostgresSql(stmt), values: [] }
  }
  return { text: toPostgresSql(stmt.sql), values: stmt.args ?? [] }
}

export function createPgExecutor(connectionString: string): DbExecutor {
  async function execute(stmt: string | DbQuery): Promise<DbResult> {
    const { text, values } = normalizeQuery(stmt)
    const res = await getPool(connectionString).query({ text, values })
    return { rows: (res.rows ?? []).map(mapRow) }
  }

  async function batch(queries: DbQuery[]): Promise<DbResult[]> {
    if (queries.length === 0) return []
    const client = await getPool(connectionString).connect()
    try {
      await client.query("BEGIN")
      const results: DbResult[] = []
      for (const q of queries) {
        const { text, values } = normalizeQuery(q)
        const res = await client.query({ text, values })
        results.push({ rows: (res.rows ?? []).map(mapRow) })
      }
      await client.query("COMMIT")
      return results
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  }

  return { execute, batch }
}
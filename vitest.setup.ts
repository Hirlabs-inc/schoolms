import { vi } from "vitest"

vi.mock("server-only", () => ({}))

// --- localStorage mock ---
const store: Record<string, string> = {}
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    get length() { return Object.keys(store).length },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  },
  writable: true,
})

// --- crypto.randomUUID mock ---
let uuidCounter = 0
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: vi.fn(() => {
      uuidCounter++
      return `00000000-0000-0000-0000-${String(uuidCounter).padStart(12, "0")}`
    }),
  },
  writable: true,
})

// --- Environment variables ---
process.env.NEXT_PUBLIC_JWT_SECRET = "test-secret"
process.env.NEXT_PUBLIC_TURSO_URL = "https://test.turso.com"
process.env.NEXT_PUBLIC_TURSO_TOKEN = "test-token"
process.env.TURSO_URL = "https://test.turso.com"
process.env.TURSO_TOKEN = "test-token"
process.env.JWT_SECRET = "test-secret"

// --- Turso mock ---
// In-memory database: keyed by table name, value is array of row objects
const tables: Record<string, any[]> = {
  profiles: [],
  students: [],
  teachers: [],
  classes: [],
  courses: [],
  exams: [],
  exam_results: [],
  attendance: [],
  fees: [],
  payments: [],
  expenses: [],
  income: [],
  teacher_contracts: [],
  payroll_records: [],
  enrollment_progress: [],
  institution_settings: [],
}

/** Strip trailing GROUP BY / ORDER BY / LIMIT. */
function stripTrailing(sql: string) {
  return sql
    .replace(/\s+group\s+by\s+.+$/i, "")
    .replace(/\s+order\s+by\s+.+$/i, "")
    .replace(/\s+limit\s+.+$/i, "")
}

/** Parse VALUES clause into an array of expressions, replacing ? with actual args. */
function parseValues(valuesStr: string, args: any[]) {
  // Split by commas not inside quotes
  const parts: string[] = []
  let depth = 0, current = "", inQuote = false
  for (const ch of valuesStr) {
    if (ch === "'" ) { inQuote = !inQuote; current += ch; continue }
    if (ch === "(" && !inQuote) { depth++; if (depth > 1) current += ch; continue }
    if (ch === ")" && !inQuote) { depth--; if (depth > 0) current += ch; continue }
    if (ch === "," && depth <= 0) { parts.push(current.trim()); current = ""; continue }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())

  // Map each part to a value
  let argIdx = 0
  return parts.map(p => {
    if (p === "?") return args[argIdx++]
    if (/^'/.test(p)) return p.replace(/^'(.*)'$/, "$1")
    if (/^\d/.test(p)) return Number(p)
    return p
  })
}

/** Parse a simple expression like `col = ?` or `col = 'val'` and return [col, value]. */
function parseCondition(cond: string, args: any[], argIdx: { idx: number }): [string, (r: any) => boolean] | null {
  // col >= ?, col <= ?, etc
  const opMatch = cond.match(/(\w+)\s*(>=|<=|!=|<>|=|>|<)\s*(.+)/i)
  if (opMatch) {
    const col = opMatch[1]
    const op = opMatch[2]
    const raw = opMatch[3].trim()
    const val = raw === "?" ? args[argIdx.idx++] : raw.replace(/^'(.*)'$/, "$1")
    const numVal = Number(val)
    const isNumeric = !isNaN(numVal) && typeof val !== "string"
    switch (op) {
      case "=": return [col, (r: any) => String(r[col]) === String(val)]
      case ">=": return [col, (r: any) => { const rv = r[col]; return isNumeric ? Number(rv) >= numVal : String(rv) >= String(val) }]
      case "<=": return [col, (r: any) => { const rv = r[col]; return isNumeric ? Number(rv) <= numVal : String(rv) <= String(val) }]
      case ">": return [col, (r: any) => { const rv = r[col]; return isNumeric ? Number(rv) > numVal : String(rv) > String(val) }]
      case "<": return [col, (r: any) => { const rv = r[col]; return isNumeric ? Number(rv) < numVal : String(rv) < String(val) }]
      case "!=": case "<>": return [col, (r: any) => String(r[col]) !== String(val)]
    }
  }
  return null
}

function whereMatches(row: any, whereClause: string | null, args: any[]): boolean {
  const parts = (whereClause ?? "").split(/\s+AND\s+/i)
  const state = { idx: 0 }
  return parts.every((cond: string) => {
    const result = parseCondition(cond, args, state)
    if (!result) return true // unrecognized — skip
    return result[1](row)
  })
}

function parseSql(sql: string) {
  // INSERT INTO table (cols) VALUES (...)
  const insertMatch = sql.match(/insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i)
  if (insertMatch) return { type: "insert" as const, table: insertMatch[1], cols: insertMatch[2].replace(/"/g, "").split(",").map((c: string) => c.trim()), valuesStr: insertMatch[3] }

  // SELECT ... FROM table [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT ...]
  if (/^select\s/i.test(sql)) {
    const fromIdx = sql.toLowerCase().indexOf("from")
    if (fromIdx >= 0) {
      const selectExpr = sql.substring(6, fromIdx).trim()
      const rest = sql.substring(fromIdx).trim()
      const tableMatch = rest.match(/^from\s+(\w+)/i)
      if (tableMatch) {
        const table = tableMatch[1]
        const afterTable = rest.substring(tableMatch[0].length).trim()
        const stripped = stripTrailing(afterTable)
        const whereMatch = stripped.match(/^where\s+(.+)/i)
        return { type: "select" as const, table, selectExpr, whereClause: whereMatch ? whereMatch[1] : null }
      }
    }
  }

  // UPDATE table SET ... WHERE ... [RETURNING *]
  const updateMatch = sql.match(/update\s+(\w+)\s+set\s+(.*?)(?:\s+where\s+(.*?))?(?:\s+returning\s+\*)?$/i)
  if (updateMatch) return { type: "update" as const, table: updateMatch[1], setClause: updateMatch[2], whereClause: updateMatch[3] }

  // DELETE FROM table WHERE ...
  const deleteMatch = sql.match(/delete\s+from\s+(\w+)\s+where\s+(.+)/i)
  if (deleteMatch) return { type: "delete" as const, table: deleteMatch[1], whereClause: deleteMatch[2] }

  return null
}



type ExecArg = { sql: string; args?: any[] } | string

const execute = vi.fn(async (arg: ExecArg): Promise<{ rows: any[] }> => {
  const sql = typeof arg === "string" ? arg : arg.sql
  const args = typeof arg === "string" ? [] : arg.args || []
  const parsed = parseSql(sql)
  if (!parsed) return { rows: [] }

  const { table } = parsed
  if (!tables[table]) tables[table] = []

  // --- INSERT ---
  if (parsed.type === "insert") {
    const vals = parseValues(parsed.valuesStr, args)
    const row: any = {}
    parsed.cols.forEach((c: string, i: number) => { row[c] = vals[i] })
    tables[table].push(row)
    return { rows: [row] }
  }

  // --- DELETE ---
  if (parsed.type === "delete") {
    tables[table] = tables[table].filter((r: any) => !whereMatches(r, parsed.whereClause, args))
    return { rows: [] }
  }

  // --- UPDATE ---
  if (parsed.type === "update") {
    const setParts = parsed.setClause.split(",").map((s: string) => s.trim())
    const colVals: Record<string, any> = {}
    let argIdx = 0
    setParts.forEach((part: string) => {
      const m = part.match(/"(\w+)"\s*=\s*\?/i) || part.match(/(\w+)\s*=\s*\?/i)
      if (m) { colVals[m[1]] = args[argIdx]; argIdx++ }
    })
    // Remaining args after set values are for WHERE clause
    const whereArgs = args.slice(argIdx)
    const updatedRows: any[] = []
    tables[table] = tables[table].map((r: any) => {
      if (parsed.whereClause && whereMatches(r, parsed.whereClause, whereArgs)) {
        const updated = { ...r, ...colVals }
        updatedRows.push(updated)
        return updated
      }
      return r
    })
    return { rows: updatedRows }
  }

  // --- SELECT ---
  let rows = [...tables[table]]
  if (parsed.whereClause) {
    rows = rows.filter(r => whereMatches(r, parsed.whereClause, args))
  }

  const expr = parsed.selectExpr.toLowerCase()
  const hasGroupBy = sql.toLowerCase().includes("group by")

  // Extract all aliases, mapped by their function type
  // e.g. "sum(amount) as totalPayroll, count(*) as payCount" → sums=["totalPayroll"], counts=["payCount"]
  const sumAliases: string[] = [...sql.matchAll(/sum\s*\([^)]+\)(?:\s+as\s+(\w+))?/gi)].map(m => m[1] || "total")
  const countAliases: string[] = [...sql.matchAll(/count\s*\([^)]+\)(?:\s+as\s+(\w+))?/gi)].map(m => m[1] || "cnt")
  const avgAliases: string[] = [...sql.matchAll(/avg\s*\([^)]+\)(?:\s+as\s+(\w+))?/gi)].map(m => m[1] || "avgPct")

  // GROUP BY (aggregated per category/status)
  if (hasGroupBy) {
    const groupColMatch = sql.match(/group\s+by\s+(\w+)/i)
    const groupCol = groupColMatch ? groupColMatch[1] : "category"
    const sumAlias = sumAliases[0] || "total"
    const countAlias = countAliases[0] || "cnt"
    const groups: Record<string, any> = {}
    rows.forEach((r: any) => {
      const key = String(r[groupCol] ?? "OTHER")
      if (!groups[key]) groups[key] = { [groupCol]: key, [sumAlias]: 0, [countAlias]: 0 }
      groups[key][sumAlias] += Number(r.amount || 0)
      groups[key][countAlias] += 1
    })
    return { rows: Object.values(groups) }
  }

  // COUNT(*) without GROUP BY
  if (countAliases.length > 0 && sumAliases.length === 0 && avgAliases.length === 0) {
    return { rows: [{ [countAliases[0] || "cnt"]: rows.length }] }
  }

  // SUM / AVG aggregates without GROUP BY
  const hasSum = sumAliases.length > 0
  const hasAvg = avgAliases.length > 0

  if (hasSum) {
    const sumColMatch = sql.match(/sum\s*\(\s*(\w+)\s*\)/i)
    const sumCol = sumColMatch ? sumColMatch[1] : "amount"
    const total = rows.reduce((s: number, r: any) => s + Number(r[sumCol] || 0), 0)
    const count = rows.length

    const outRow: any = {}
    // Map sum alias to the first position
    sumAliases.forEach((alias, i) => { outRow[alias] = i === 0 ? total : rows.length })
    // Map count aliases to their positions
    countAliases.forEach((alias, i) => { outRow[alias] = i === 0 ? rows.length : rows.length })
    if (sumAliases.length === 0 && countAliases.length === 0) {
      outRow.totalPayroll = total
      outRow.payCount = count
    }
    return { rows: rows.length === 0 ? [{ totalPayroll: 0, payCount: 0 }] : [outRow] }
  }

  if (hasAvg) {
    const avgColMatch = sql.match(/avg\s*\(\s*(\w+)\s*\)/i)
    const avgCol = avgColMatch ? avgColMatch[1] : "progressPercent"
    const total = rows.reduce((s: number, r: any) => s + Number(r[avgCol] || 0), 0)
    const avg = rows.length > 0 ? total / rows.length : 0
    const alias = avgAliases[0] || "avgPct"
    return { rows: rows.length === 0 ? [{ [alias]: 0 }] : [{ [alias]: avg }] }
  }

  // For "select id from ..." (upsert check)
  if (expr === "id") {
    return { rows: rows.map(r => ({ id: r.id })) }
  }

  // Simple select *
  return { rows }
})

vi.mock("@libsql/client/web", () => ({
  createClient: vi.fn(() => ({ execute })),
}))

// --- bcryptjs mock ---
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pw: string, salt: number) => `hashed_${pw}`),
    compare: vi.fn(async (pw: string, hash: string) => hash === `hashed_${pw}`),
  },
  hash: vi.fn(async (pw: string, salt: number) => `hashed_${pw}`),
  compare: vi.fn(async (pw: string, hash: string) => hash === `hashed_${pw}`),
}))

// --- jose mock ---
class MockSignJWT {
  payload: any
  constructor(payload: any) { this.payload = payload }
  setProtectedHeader() { return this }
  setIssuedAt() { return this }
  setExpirationTime() { return this }
  sign() { return Promise.resolve("mock-jwt-token") }
}

vi.mock("jose", () => ({
  SignJWT: MockSignJWT,
  jwtVerify: vi.fn(async (token: string) => {
    // Make the mock dynamic based on the stored token
    const stored = globalThis.localStorage?.getItem("auth_token")
    if (stored === "mock-student-token") {
      return {
        payload: { sub: "stu-1", role: "STUDENT", email: "student@test.com", firstName: "Stud", lastName: "Ent" },
      }
    }
    if (stored === "mock-teacher-token") {
      return {
        payload: { sub: "tch-1", role: "TEACHER", email: "teacher@test.com", firstName: "Teach", lastName: "Er" },
      }
    }
    return {
      payload: { sub: "admin-1", role: "ADMIN", email: "admin@school.com", firstName: "Admin", lastName: "User" },
    }
  }),
}))

// --- fetch mock for auth endpoints ---
const originalFetch = globalThis.fetch
globalThis.fetch = vi.fn(async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url || ""
  const method = init?.method || "GET"
  const headers = init?.headers || {}
  const body = init?.body ? JSON.parse(init.body) : {}

  if (url.includes("/api/auth/login") && method === "POST") {
    const { email, password } = body
    const user = tables.profiles.find((p: any) => p.email === email)
    if (!user) {
      return { ok: false, status: 401, json: async () => ({ error: "Invalid email or password" }) } as any
    }
    const bcrypt = await import("bcryptjs")
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return { ok: false, status: 401, json: async () => ({ error: "Invalid email or password" }) } as any
    }
    const token = "mock-jwt-token"
    return {
      ok: true, status: 200,
      json: async () => ({
        token,
        user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }
      })
    } as any
  }

  if (url.includes("/api/auth/me")) {
    const authHeader = headers?.Authorization || headers?.authorization || ""
    if (!authHeader) {
      return { ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) } as any
    }
    const stored = globalThis.localStorage?.getItem("auth_token")
    if (!stored) {
      return { ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) } as any
    }
    if (stored === "mock-student-token") {
      const user = { id: "stu-1", role: "STUDENT", email: "student@test.com", firstName: "Stud", lastName: "Ent" }
      return { ok: true, status: 200, json: async () => ({ user }) } as any
    }
    if (stored === "mock-teacher-token") {
      const user = { id: "tch-1", role: "TEACHER", email: "teacher@test.com", firstName: "Teach", lastName: "Er" }
      return { ok: true, status: 200, json: async () => ({ user }) } as any
    }
    const user = { id: "admin-1", role: "ADMIN", email: "admin@school.com", firstName: "Admin", lastName: "User" }
    return { ok: true, status: 200, json: async () => ({ user }) } as any
  }

  if (url.includes("/api/db")) {
    const { sql, args } = body
    try {
      const result = await execute({ sql, args: args || [] })
      return { ok: true, status: 200, json: async () => ({ rows: result.rows }) } as any
    } catch (e: any) {
      return { ok: false, status: 500, json: async () => ({ error: e.message }) } as any
    }
  }

  if (originalFetch) return originalFetch(input, init)
  return { ok: false, status: 404, json: async () => ({ error: "Not found" }) } as any
}) as any

// --- Helper to reset DB between tests ---
export function resetDb() {
  Object.keys(tables).forEach(k => { tables[k] = [] })
  uuidCounter = 0
  Object.keys(store).forEach(k => delete store[k])
}

export { execute, tables }

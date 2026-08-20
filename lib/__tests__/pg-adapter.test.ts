import { describe, it, expect } from "vitest"
import { toPostgresSql, toCamel, mapRow } from "../pg-adapter"

describe("toPostgresSql", () => {
  it("rewrites ? placeholders to $N", () => {
    expect(toPostgresSql("select * from fees where studentId = ? and courseId = ?"))
      .toBe("select * from fees where studentId = $1 and courseId = $2")
  })

  it("skips ? inside string literals", () => {
    expect(toPostgresSql("select * from income where status = 'PAID?' and amount = ?"))
      .toBe("select * from income where status = 'PAID?' and amount = $1")
  })

  it("handles escaped quotes inside string literals", () => {
    expect(toPostgresSql("insert into x (a) values ('it''s ? ?')"))
      .toBe("insert into x (a) values ('it''s ? ?')")
  })

  it("lowercases quoted camelCase identifiers", () => {
    expect(toPostgresSql('delete from fees where "studentId" = ?'))
      .toBe("delete from fees where studentid = $1")
    expect(toPostgresSql('select "courseId", "teacherId" from course_teachers where "courseId" = ?'))
      .toBe("select courseid, teacherid from course_teachers where courseid = $1")
  })

  it("rewrites insert or ignore into to on conflict do nothing", () => {
    expect(toPostgresSql("insert or ignore into profiles (id, email, password, role) values (?, ?, ?, ?)"))
      .toBe("insert into profiles (id, email, password, role) values ($1, $2, $3, $4) on conflict do nothing")
  })

  it("rewrites insert or replace into to a real upsert", () => {
    expect(toPostgresSql("insert or replace into institution_settings (id, name, currency, receiptHeader) values (?, ?, ?, ?)"))
      .toBe("insert into institution_settings (id, name, currency, receiptHeader) values ($1, $2, $3, $4) on conflict (id) do update set name = excluded.name, currency = excluded.currency, receiptheader = excluded.receiptheader")
  })

  it("handles string literals like 'COMMISSION' and 'PAID'", () => {
    expect(toPostgresSql("insert into payroll_records (id, teacherId, amount) values (?, ?, 'COMMISSION')"))
      .toBe("insert into payroll_records (id, teacherId, amount) values ($1, $2, 'COMMISSION')")
  })

  it("keeps unquoted mixed-case identifiers (postgres folds them) and limit/order by intact", () => {
    expect(toPostgresSql("select id from teacher_contracts where teacherId = ? and status = 'ACTIVE' order by createdAt desc limit 1"))
      .toBe("select id from teacher_contracts where teacherId = $1 and status = 'ACTIVE' order by createdAt desc limit 1")
  })

  it("handles returning *", () => {
    expect(toPostgresSql('update fees set "balance" = ? where id = ? returning *'))
      .toBe("update fees set balance = $1 where id = $2 returning *")
  })

  it("preserves unquoted mixed-case aliases (postgres folds them to lowercase)", () => {
    expect(toPostgresSql("select sum(amount) as totalPayroll, count(*) as payCount from payroll_records where status = 'PAID'"))
      .toBe("select sum(amount) as totalPayroll, count(*) as payCount from payroll_records where status = 'PAID'")
  })
})

describe("toCamel / mapRow", () => {
  it("maps lowercase schema keys back to camelCase", () => {
    expect(mapRow({
      id: "1", studentid: "s1", totalfee: 100, balance: 50, createdat: "2026-01-01",
      resettokenexpiry: "x", progresspercent: 40, avgpct: 0.4,
    })).toEqual({
      id: "1", studentId: "s1", totalFee: 100, balance: 50, createdAt: "2026-01-01",
      resetTokenExpiry: "x", progressPercent: 40, avgPct: 0.4,
    })
  })

  it("camelizes underscored keys not in the dict", () => {
    expect(toCamel("some_future_column")).toBe("someFutureColumn")
  })

  it("passes through single-word keys unchanged", () => {
    expect(toCamel("name")).toBe("name")
    expect(toCamel("status")).toBe("status")
    expect(toCamel("cnt")).toBe("cnt")
  })

  it("maps count/sum aliases", () => {
    expect(toCamel("totalpayroll")).toBe("totalPayroll")
    expect(toCamel("paycount")).toBe("payCount")
  })
})
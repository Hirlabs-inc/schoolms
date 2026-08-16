import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem, deleteItem, upsertItem } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Courses CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("add course with all fields", async () => {
    const course = await addItem("courses", {
      name: "Mathematics", code: "MTH101", classId: "cl1", teacherId: "t1", fee: 50000, duration: "6 months",
    } as any)
    expect(course.id).toBeDefined()
    expect(tables.courses).toHaveLength(1)
    expect(tables.courses[0].name).toBe("Mathematics")
    expect(tables.courses[0].fee).toBe(50000)
  })

  it("get all courses", async () => {
    tables.courses.push(
      { id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" },
      { id: "c2", name: "Science", code: "SCI", classId: "cl1", teacherId: "t2" },
    )
    const courses = await getItems<any>("courses")
    expect(courses).toHaveLength(2)
  })

  it("update course", async () => {
    tables.courses.push({ id: "c1", name: "Old", code: "OLD", classId: "cl1", teacherId: "t1" })
    const updated = await updateItem("courses", "c1", { name: "New", teacherId: "t2" } as any)
    expect(updated.name).toBe("New")
    expect(updated.teacherId).toBe("t2")
  })

  it("delete course", async () => {
    tables.courses.push({ id: "c1", name: "Del", code: "DEL", classId: "cl1", teacherId: "t1" })
    await deleteItem("courses", "c1")
    expect(tables.courses).toHaveLength(0)
  })

  it("upsert course - insert new", async () => {
    const c = await upsertItem("courses", { name: "New", code: "NEW", classId: "cl1", teacherId: "t1" } as any)
    expect(c.id).toBeDefined()
    expect(tables.courses).toHaveLength(1)
  })

  it("upsert course - update existing", async () => {
    tables.courses.push({ id: "c1", name: "Old", code: "OLD", classId: "cl1", teacherId: "t1" })
    const c = await upsertItem("courses", { id: "c1", name: "Updated", code: "OLD", classId: "cl1", teacherId: "t1" } as any)
    expect(c.name).toBe("Updated")
    expect(tables.courses).toHaveLength(1)
  })

  it("course with preserved id", async () => {
    const c = await addItem("courses", { id: "custom-id", name: "Art", code: "ART", classId: "cl1", teacherId: "t1" } as any)
    expect(c.id).toBe("custom-id")
  })
})

describe("Classes CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("add class", async () => {
    const cls = await addItem("classes", { name: "Grade 1", gradeLevel: 1 } as any)
    expect(cls.id).toBeDefined()
    expect(tables.classes).toHaveLength(1)
  })

  it("get all classes", async () => {
    tables.classes.push(
      { id: "cl1", name: "Grade 1", gradeLevel: 1 },
      { id: "cl2", name: "Grade 2", gradeLevel: 2 },
    )
    const classes = await getItems<any>("classes")
    expect(classes).toHaveLength(2)
  })

  it("update class", async () => {
    tables.classes.push({ id: "cl1", name: "Old Grade", gradeLevel: 1 })
    const updated = await updateItem("classes", "cl1", { name: "Grade 1 Updated" } as any)
    expect(updated.name).toBe("Grade 1 Updated")
  })

  it("delete class", async () => {
    tables.classes.push({ id: "cl1", name: "Grade 1", gradeLevel: 1 })
    await deleteItem("classes", "cl1")
    expect(tables.classes).toHaveLength(0)
  })

  it("multiple classes with different grade levels", async () => {
    for (let i = 1; i <= 12; i++) {
      await addItem("classes", { name: `Grade ${i}`, gradeLevel: i } as any)
    }
    expect(tables.classes).toHaveLength(12)
  })
})

describe("Course-Class relationship", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("courses linked to a class", async () => {
    tables.classes.push({ id: "cl1", name: "Grade 1", gradeLevel: 1 })
    tables.courses.push(
      { id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" },
      { id: "c2", name: "Eng", code: "ENG", classId: "cl1", teacherId: "t2" },
      { id: "c3", name: "Sci", code: "SCI", classId: "cl2", teacherId: "t1" },
    )
    const all = await getItems<any>("courses")
    const inClass = all.filter((c: any) => c.classId === "cl1")
    expect(inClass).toHaveLength(2)
  })

  it("course teacher assignment", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    await updateItem("courses", "c1", { teacherId: "t2" } as any)
    expect(tables.courses[0].teacherId).toBe("t2")
  })

  it("course teacher unassignment (set to null)", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    await updateItem("courses", "c1", { teacherId: null } as any)
    expect(tables.courses[0].teacherId).toBeNull()
  })
})

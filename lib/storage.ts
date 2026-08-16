// LocalStorage-based auth (fallback/dev mode)
// Demo credentials
export const DEMO_USERS = {
  admin: { email: "admin@school.edu", password: "admin123" },
  teacher: { email: "teacher@school.edu", password: "teacher123" },
  student: { email: "student@school.edu", password: "student123" },
}

export function initializeStorage() {
  if (typeof window === "undefined") return
  if (localStorage.getItem("trainify_initialized")) return

  // Nothing to pre-initialize — data comes from Supabase
  localStorage.setItem("trainify_initialized", "true")
}

export function login(email: string, password: string) {
  const users = JSON.parse(localStorage.getItem("users") || "[]")
  const user = users.find((u: any) => u.email === email && u.password === password)
  if (user) {
    localStorage.setItem("currentUser", JSON.stringify(user))
    return user
  }
  return null
}

export function logout() {
  localStorage.removeItem("currentUser")
}

export function getCurrentUser() {
  const userStr = localStorage.getItem("currentUser")
  return userStr ? JSON.parse(userStr) : null
}

export function getItems<T>(key: string): T[] {
  return JSON.parse(localStorage.getItem(key) || "[]")
}

export function setItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export function addItem<T extends { id: string }>(key: string, item: T) {
  const items = getItems<T>(key)
  items.push(item)
  setItems(key, items)
}

export function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>) {
  const items = getItems<T>(key)
  const index = items.findIndex((item: any) => item.id === id)
  if (index !== -1) {
    items[index] = { ...items[index], ...updates }
    setItems(key, items)
  }
}

export function deleteItem(key: string, id: string) {
  const items = getItems<any>(key)
  const filtered = items.filter((item: any) => item.id !== id)
  setItems(key, filtered)
}

export function generateStudentNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `STU-${year}-${random}`
}

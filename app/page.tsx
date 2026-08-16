"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { initializeStorage, getCurrentUser } from "@/lib/storage"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    initializeStorage()

    const user = getCurrentUser()
    if (user) {
      switch (user.role) {
        case "ADMIN":
          router.push("/admin")
          break
        case "TEACHER":
          router.push("/teacher")
          break
        case "STUDENT":
          router.push("/student")
          break
      }
    } else {
      router.push("/login")
    }
  }, [router])

  return null
}

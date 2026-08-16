"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { getCurrentUser as getCurrentUserAPI } from "@/lib/api"
import type { User } from "@/lib/types"

interface UserContextType {
  user: User | null
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = localStorage.getItem("currentUser")
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUserAPI()
      if (currentUser) {
        setUser(currentUser)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadUser() }, [])

  const refreshUser = async () => {
    setIsLoading(true)
    await loadUser()
  }

  return (
    <UserContext.Provider value={{ user, isLoading, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

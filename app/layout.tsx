import type React from "react"
import type { Metadata } from "next"
import { Onest } from "next/font/google"
import "./globals.css"

import { Toaster } from "@/components/ui/toaster"
import { UserProvider } from "@/contexts/user-context"

const onest = Onest({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Trainify Technology Training Institute",
  description: "School Management System - Trainify Technology Training Institute",
  generator: "Trainify",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <UserProvider>
          {children}
          <Toaster />
        </UserProvider>
      </body>
    </html>
  )
}

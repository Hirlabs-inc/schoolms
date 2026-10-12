"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string[]>([])
  const [error, setError] = useState("")

  const isProd = process.env.NODE_ENV === "production"

  const handleSeed = async () => {
    if (isProd) {
      setError("Demo seeding is disabled in production.")
      return
    }
    setLoading(true)
    setStatus([])
    setError("")
    try {
      const res = await fetch("/api/dev/seed", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as any)?.error || "Seeding failed")
      setStatus((data as any).steps ?? [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Database Seeding</CardTitle>
          <CardDescription>Initialize Trainify with demo users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-md text-sm text-yellow-800 border border-yellow-200">
            <p>This will create demo users for Trainify Technology Training Institute:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Admin:</strong> admin@school.edu / admin12345</li>
              <li><strong>Teacher:</strong> teacher@school.edu / teacher12345</li>
              <li><strong>Student:</strong> student@school.edu / student12345</li>
            </ul>
            <p className="mt-2">Change these passwords immediately after first login.</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-white">
            {status.length === 0 && <p className="text-sm text-gray-400 italic">Ready to seed...</p>}
            {status.map((msg, i) => (
              <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                {msg.includes("✅") ? <CheckCircle className="h-3 w-3 text-green-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
                {msg}
              </div>
            ))}
          </div>

          <Button onClick={handleSeed} className="w-full" disabled={loading || isProd}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Seeding...</> : "Seed Database"}
          </Button>
          {isProd && (
            <p className="text-xs text-red-600">
              Seeding is disabled in production. Create the first admin directly in the database.
            </p>
          )}

          <Button variant="outline" className="w-full" onClick={() => window.location.href = "/login"}>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

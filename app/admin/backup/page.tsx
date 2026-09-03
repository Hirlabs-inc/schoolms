"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, Upload, Database, Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function BackupPage() {
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleBackup = async () => {
    setIsBackingUp(true)
    setMessage(null)
    try {
      // Collect all data from localStorage tables
      const tables = ["users", "students", "teachers", "classes", "courses", "exams", "examResults", "attendance", "fees", "payments", "expenses", "income", "teacherContracts", "teacherCommissions", "payrollRecords", "enrollmentProgress", "courseTeachers", "profiles"]
      const backup: Record<string, any> = {}

      for (const table of tables) {
        const data = localStorage.getItem(table)
        if (data) {
          backup[table] = JSON.parse(data)
        }
      }

      // Also backup institution settings
      const settings = localStorage.getItem("institutionSettings")
      if (settings) backup.institutionSettings = JSON.parse(settings)

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      const date = new Date().toISOString().split("T")[0]
      link.download = `trainify_backup_${date}.json`
      link.click()
      URL.revokeObjectURL(link.href)

      setMessage({ type: "success", text: "Backup downloaded successfully!" })
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Backup failed" })
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsRestoring(true)
    setMessage(null)

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      let restored = 0
      for (const [table, data] of Object.entries(backup)) {
        if (Array.isArray(data)) {
          localStorage.setItem(table, JSON.stringify(data))
          restored++
        } else if (typeof data === "object" && table === "institutionSettings") {
          localStorage.setItem(table, JSON.stringify(data))
          restored++
        }
      }

      setMessage({ type: "success", text: `Restored ${restored} tables from backup. Refreshing data...` })
      setTimeout(() => window.location.reload(), 1500)
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Restore failed. Check file format." })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Backup Database
              </CardTitle>
              <CardDescription>
                Download all system data as a JSON backup file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will export all student records, payments, expenses, courses, and settings
                to a single JSON file. Store this file in a safe location.
              </p>
              <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
                {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download Backup
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Restore Database
              </CardTitle>
              <CardDescription>
                Restore data from a previous backup file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a previously downloaded backup JSON file to restore your data.
                This will overwrite all current data.
              </p>
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  disabled={isRestoring}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                />
              </div>
              {isRestoring && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring data...
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Export specific data tables for external analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use the Reports section to export specific reports (Income, Expenses, Outstanding Balances) in PDF or CSV format.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/admin/reports"}>
                Go to Reports
              </Button>
            </CardContent>
          </Card>
        </div>

        {message && (
          <Alert variant={message.type === "success" ? "default" : "destructive"} className="mt-6">
            {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
  </>
  )
}

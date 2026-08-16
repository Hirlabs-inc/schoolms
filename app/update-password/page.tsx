"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updatePassword, getCurrentUser } from "@/lib/api"
import { GraduationCap, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function UpdatePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState("")
    const [verifying, setVerifying] = useState(true)

    useEffect(() => {
        // Check if we have a session (Supabase handles the token from URL automatically)
        const checkSession = async () => {
            try {
                const user = await getCurrentUser()
                if (!user) {
                    // If no user, the link might be invalid or expired
                    setError("Invalid or expired reset link. Please try requesting a new one.")
                }
            } catch (err) {
                setError("Failed to verify session.")
            } finally {
                setVerifying(false)
            }
        }

        // Give Supabase a moment to process the hash fragment
        setTimeout(checkSession, 1000)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long")
            return
        }

        setLoading(true)

        try {
            await updatePassword(password)
            setSuccess(true)
            // Redirect after a delay
            setTimeout(() => {
                router.push("/login")
            }, 3000)
        } catch (err: any) {
            console.error(err)
            setError(err.message || "Failed to update password")
        } finally {
            setLoading(false)
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Verifying reset link...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary text-primary-foreground">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">School Management System</h1>
                    <p className="text-muted-foreground">Set your new password</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Update Password</CardTitle>
                        <CardDescription>
                            Please enter your new password below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center">
                                    <CheckCircle className="h-12 w-12 text-green-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-medium">Password Updated!</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Your password has been changed successfully. Redirecting to login...
                                    </p>
                                </div>
                                <Button asChild className="w-full">
                                    <Link href="/login">Go to Login</Link>
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">New Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Enter new password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update Password"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

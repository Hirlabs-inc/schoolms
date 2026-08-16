"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { resetPassword } from "@/lib/api"
import { GraduationCap, Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            await resetPassword(email)
            setSubmitted(true)
        } catch (err: any) {
            console.error(err)
            setError(err.message || "Failed to send reset email")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary text-primary-foreground">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">School Management System</h1>
                    <p className="text-muted-foreground">Reset your password</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Forgot Password</CardTitle>
                        <CardDescription>
                            Enter your email address and we'll send you a link to reset your password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {submitted ? (
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center">
                                    <CheckCircle className="h-12 w-12 text-green-500" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-medium">Check your email</h3>
                                    <p className="text-sm text-muted-foreground">
                                        We have sent a password reset link to <strong>{email}</strong>.
                                    </p>
                                </div>
                                <Button asChild className="w-full" variant="outline">
                                    <Link href="/login">Back to Login</Link>
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your.email@school.edu"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                {error && (
                                    <Alert variant="destructive">
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Reset Link"}
                                </Button>

                                <div className="text-center text-sm">
                                    <Link href="/login" className="text-primary hover:underline flex items-center justify-center gap-1">
                                        <ArrowLeft className="h-3 w-3" /> Back to Login
                                    </Link>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

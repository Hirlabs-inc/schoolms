"use client"

import { useState, useEffect } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser, updatePassword, getItems, upsertItem } from "@/lib/api"
import type { InstitutionSettings } from "@/lib/types"
import { Settings, Loader2, CheckCircle, AlertCircle, LayoutDashboard, Building2, KeyRound } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
    const [user, setUser] = useState<any>(null)
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const { toast } = useToast()

    // Institution settings
    const [instSettings, setInstSettings] = useState<InstitutionSettings>({
        id: "main",
        name: "Trainify Technology Training Institute",
        currency: "KES",
        receiptHeader: "",
        contactEmail: "",
        contactPhone: "",
        address: "",
    })
    const [isSavingSettings, setIsSavingSettings] = useState(false)
    const [settingsMessage, setSettingsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
        if (!currentUser) return

        try {
            const settings = await getItems<InstitutionSettings>("institutionSettings")
            if (settings.length > 0) {
                setInstSettings(settings[0])
            }
        } catch (error) {
            console.error("Failed to load settings", error)
        }
    }

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match" })
            return
        }

        if (newPassword.length < 6) {
            setMessage({ type: "error", text: "Password must be at least 6 characters long" })
            return
        }

        setIsLoading(true)
        try {
            await updatePassword(newPassword)
            setMessage({ type: "success", text: "Password updated successfully" })
            setNewPassword("")
            setConfirmPassword("")
            toast({ title: "Success", description: "Your password has been updated." })
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to update password" })
            toast({ title: "Error", description: error.message || "Failed to update password", variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSavingSettings(true)
        setSettingsMessage(null)

        try {
            await upsertItem("institutionSettings", instSettings)
            setSettingsMessage({ type: "success", text: "Settings saved successfully" })
            toast({ title: "Success", description: "Institution settings updated." })
        } catch (error: any) {
            setSettingsMessage({ type: "error", text: error.message || "Failed to save settings" })
        } finally {
            setIsSavingSettings(false)
        }
    }

    const getBackLink = () => {
        if (!user) return "/"
        switch (user.role) {
            case "ADMIN": return "/admin"
            case "TEACHER": return "/teacher"
            case "STUDENT": return "/student"
            default: return "/"
        }
    }

    const navigation = [
        { name: "Dashboard", href: getBackLink(), icon: LayoutDashboard },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    return (
        <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
            <DashboardLayout navigation={navigation} title="Settings">
                <div className="max-w-2xl mx-auto">
                    <Tabs defaultValue={user?.role === "ADMIN" ? "institution" : "account"}>
                        <TabsList className="mb-4">
                            {user?.role === "ADMIN" && (
                                <TabsTrigger value="institution">
                                    <Building2 className="h-4 w-4 mr-2" />
                                    Institution
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="account">
                                <KeyRound className="h-4 w-4 mr-2" />
                                Account
                            </TabsTrigger>
                        </TabsList>

                        {user?.role === "ADMIN" && (
                            <TabsContent value="institution">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Institution Settings</CardTitle>
                                        <CardDescription>Configure your institution details</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleSaveSettings} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="instName">Institution Name</Label>
                                                <Input
                                                    id="instName"
                                                    value={instSettings.name}
                                                    onChange={(e) => setInstSettings({ ...instSettings, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="currency">Default Currency</Label>
                                                <Input
                                                    id="currency"
                                                    value={instSettings.currency}
                                                    onChange={(e) => setInstSettings({ ...instSettings, currency: e.target.value })}
                                                    placeholder="KES"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="receiptHeader">Receipt Header</Label>
                                                <Input
                                                    id="receiptHeader"
                                                    value={instSettings.receiptHeader || ""}
                                                    onChange={(e) => setInstSettings({ ...instSettings, receiptHeader: e.target.value })}
                                                    placeholder="Official Payment Receipt"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="contactEmail">Contact Email</Label>
                                                <Input
                                                    id="contactEmail"
                                                    type="email"
                                                    value={instSettings.contactEmail || ""}
                                                    onChange={(e) => setInstSettings({ ...instSettings, contactEmail: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                                <Input
                                                    id="contactPhone"
                                                    type="tel"
                                                    value={instSettings.contactPhone || ""}
                                                    onChange={(e) => setInstSettings({ ...instSettings, contactPhone: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="address">Address</Label>
                                                <Input
                                                    id="address"
                                                    value={instSettings.address || ""}
                                                    onChange={(e) => setInstSettings({ ...instSettings, address: e.target.value })}
                                                />
                                            </div>

                                            {settingsMessage && (
                                                <Alert variant={settingsMessage.type === "success" ? "default" : "destructive"}>
                                                    {settingsMessage.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                    <AlertDescription>{settingsMessage.text}</AlertDescription>
                                                </Alert>
                                            )}

                                            <Button type="submit" disabled={isSavingSettings}>
                                                {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Settings"}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}

                        <TabsContent value="account">
                            <div className="grid gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Profile Information</CardTitle>
                                        <CardDescription>Your personal account details</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>First Name</Label>
                                                <Input value={user?.firstName || ""} disabled />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Last Name</Label>
                                                <Input value={user?.lastName || ""} disabled />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email Address</Label>
                                            <Input value={user?.email || ""} disabled />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Role</Label>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                                    {user?.role}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Security</CardTitle>
                                        <CardDescription>Update your password</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handlePasswordChange} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-password">New Password</Label>
                                                <Input
                                                    id="new-password"
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="Enter new password"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                                <Input
                                                    id="confirm-password"
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Confirm new password"
                                                    required
                                                />
                                            </div>

                                            {message && (
                                                <Alert variant={message.type === "success" ? "default" : "destructive"}>
                                                    {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                    <AlertDescription>{message.text}</AlertDescription>
                                                </Alert>
                                            )}

                                            <Button type="submit" disabled={isLoading}>
                                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : "Update Password"}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DashboardLayout>
        </AuthGuard>
    )
}

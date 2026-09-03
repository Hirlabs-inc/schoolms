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
import { updateMyProfile, getItems, upsertItem } from "@/lib/api"
import type { InstitutionSettings } from "@/lib/types"
import { Settings, Loader2, CheckCircle, AlertCircle, LayoutDashboard, Building2, UserRound } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useUser } from "@/contexts/user-context"

export default function SettingsPage() {
    const { user, refreshUser } = useUser()
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [currentPassword, setCurrentPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const { toast } = useToast()

    // Editable profile fields.
    const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "" })
    const [profileCurrentPassword, setProfileCurrentPassword] = useState("")
    const [isSavingProfile, setIsSavingProfile] = useState(false)
    const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    // Institution settings (admin only)
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
        if (!user) return
        setProfileForm({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || "",
        })
        if (user.role === "ADMIN") {
            getItems<InstitutionSettings>("institutionSettings")
                .then((settings) => {
                    if (settings.length > 0) setInstSettings(settings[0])
                })
                .catch(() => {})
        }
    }, [user])

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setProfileMessage(null)

        const firstName = profileForm.firstName.trim()
        const lastName = profileForm.lastName.trim()
        const email = profileForm.email.trim()
        if (!firstName || !lastName) {
            setProfileMessage({ type: "error", text: "First and last name are required" })
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setProfileMessage({ type: "error", text: "Please enter a valid email address" })
            return
        }

        const emailChanged = !!user && email.toLowerCase() !== (user.email || "").toLowerCase()
        const patch: any = { firstName, lastName, email }
        if (emailChanged) {
            if (!profileCurrentPassword) {
                setProfileMessage({ type: "error", text: "Enter your current password to change your email" })
                return
            }
            patch.currentPassword = profileCurrentPassword
        }

        setIsSavingProfile(true)
        try {
            const res = await updateMyProfile(patch)
            if (res.user) {
                try { localStorage.setItem("currentUser", JSON.stringify(res.user)) } catch {}
                await refreshUser()
            }
            setProfileMessage({ type: "success", text: "Profile updated successfully" })
            setProfileCurrentPassword("")
            toast({ title: "Success", description: "Your profile has been updated." })
        } catch (error: any) {
            setProfileMessage({ type: "error", text: error.message || "Failed to update profile" })
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (!currentPassword) {
            setMessage({ type: "error", text: "Enter your current password" })
            return
        }
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
            await updateMyProfile({ currentPassword, newPassword })
            setMessage({ type: "success", text: "Password updated successfully" })
            setNewPassword("")
            setConfirmPassword("")
            setCurrentPassword("")
            toast({ title: "Success", description: "Your password has been updated." })
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to update password" })
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
            case "ADMIN":
            case "MANAGER":
            case "SECRETARY":
                return "/admin"
            case "TEACHER": return "/teacher"
            case "STUDENT": return "/student"
            default: return "/"
        }
    }

    const navigation = [
        { name: "Dashboard", href: getBackLink(), icon: LayoutDashboard },
        { name: "Settings", href: "/settings", icon: Settings },
    ]

    const isAdmin = user?.role === "ADMIN"

    return (
        <AuthGuard>
            <DashboardLayout navigation={navigation} title="Settings">
                <div className="max-w-2xl mx-auto">
                    <Tabs defaultValue={isAdmin ? "institution" : "account"}>
                        <TabsList className="mb-4">
                            {isAdmin && (
                                <TabsTrigger value="institution">
                                    <Building2 className="h-4 w-4 mr-2" />
                                    Institution
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="account">
                                <UserRound className="h-4 w-4 mr-2" />
                                Account
                            </TabsTrigger>
                        </TabsList>

                        {isAdmin && (
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
                                    <CardContent>
                                        <form onSubmit={handleProfileSave} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="firstName">First Name</Label>
                                                    <Input
                                                        id="firstName"
                                                        value={profileForm.firstName}
                                                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">Last Name</Label>
                                                    <Input
                                                        id="lastName"
                                                        value={profileForm.lastName}
                                                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email Address</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={profileForm.email}
                                                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="profileCurrentPassword">
                                                    Current Password
                                                    <span className="font-normal text-muted-foreground text-xs ml-1">
                                                        (required to change your email)
                                                    </span>
                                                </Label>
                                                <Input
                                                    id="profileCurrentPassword"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    value={profileCurrentPassword}
                                                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                                                    placeholder="Enter current password"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Role</Label>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                                        {user?.role}
                                                    </span>
                                                </div>
                                            </div>

                                            {profileMessage && (
                                                <Alert variant={profileMessage.type === "success" ? "default" : "destructive"}>
                                                    {profileMessage.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                    <AlertDescription>{profileMessage.text}</AlertDescription>
                                                </Alert>
                                            )}

                                            <Button type="submit" disabled={isSavingProfile}>
                                                {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Profile"}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Security</CardTitle>
                                        <CardDescription>Change your password</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handlePasswordChange} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="current-password">Current Password</Label>
                                                <Input
                                                    id="current-password"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    placeholder="Enter current password"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-password">New Password</Label>
                                                <Input
                                                    id="new-password"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="At least 6 characters"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                                <Input
                                                    id="confirm-password"
                                                    type="password"
                                                    autoComplete="new-password"
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

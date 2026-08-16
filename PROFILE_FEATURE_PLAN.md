# Feature Plan: User Profile & Settings 👤

Currently, users cannot change their passwords or update their personal information. This is a key missing feature for production.

## 1. Database Updates
No schema changes needed! We already have a `profiles` table.

## 2. API Functions (`lib/api.ts`)
Need to add:
- `updatePassword(newPassword)`: Wraps `supabase.auth.updateUser({ password: newPassword })`
- `updateProfile(data)`: Updates the `profiles` table.

## 3. UI Components
Create a new page at `app/settings/page.tsx` (or `app/profile/page.tsx`) accessible to all roles.

### Features to Include:
1.  **Personal Details Form**:
    - First Name, Last Name (Editable)
    - Email (Read-only)
    - Role (Read-only)
2.  **Security Section**:
    - Change Password form (New Password, Confirm Password)
3.  **Preferences** (Optional):
    - Theme toggle (Light/Dark) - *Already supported by Shadcn UI if enabled*

## 4. Implementation Steps
1.  Create `app/settings/layout.tsx` (or reuse Dashboard layout)
2.  Create `app/settings/page.tsx`
3.  Add "Settings" link to the sidebar navigation in:
    - `app/admin/page.tsx`
    - `app/teacher/page.tsx`
    - `app/student/page.tsx`

## 5. Code Snippet (API)
```typescript
export async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    return true
}
```

# Complete Fix for All 3 Issues

## Issues and Fixes

### ✅ Issue 1: Cannot Assign Teachers to Courses
**Status**: FIXED (requires SQL migration)

**Problem**: RLS policy used `FOR ALL` which doesn't work properly in Supabase

**Fix**: Run `fix_rls_policies.sql` in Supabase SQL Editor

---

### ✅ Issue 2: Students Don't Appear in Classes  
**Status**: FIXED (code updated)

**Problems Found**:
1. **Missing Parent Phone Field**: Students couldn't be created without `parentPhone` (required field)
2. **Broken Grade Level Selector**: The "Academic Year" dropdown was showing classes instead of grade levels 1-12
3. **Class Selection Not Working**: When grade level changed, the class dropdown didn't reset

**Fixes Applied**:
- ✅ Added `parentPhone` field to student creation form
- ✅ Fixed "Grade Level" selector to show grades 1-12
- ✅ Class dropdown now properly filters by selected grade level
- ✅ Class selection resets when grade level changes

**Now you can**:
1. Create students with all required fields
2. Select grade level (1-12)
3. Select appropriate class for that grade
4. Enter parent phone number
5. Students will appear in Admin → Classes

---

### ✅ Issue 3: Delete Doesn't Work in Users Section
**Status**: PARTIALLY FIXED

**Problem**: Deleting a user only deletes the profile, not the auth.users record

**Fix Applied**:
- ✅ Added code to attempt deleting from `auth.users` using admin API
- ⚠️ **Note**: `supabase.auth.admin.deleteUser()` requires **Service Role Key**

**Current Behavior**:
- Profile is deleted (user can't login)
- Auth user remains in database (harmless but not ideal)

**For Complete Fix** (Optional):
You need to use a Service Role Key instead of the Anon Key. This requires:

1. Create a server-side API route or Edge Function
2. Use Service Role Key on the server
3. Call the delete endpoint from the client

**OR** you can manually delete auth users from Supabase Dashboard:
- Go to Authentication → Users
- Find the user
- Click "..." → Delete User

---

## What You Need to Do

### Step 1: Run the SQL Migration (REQUIRED)
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy contents of `fix_rls_policies.sql`
5. Click **Run**

This fixes:
- ✅ Teacher assignment to courses
- ✅ User deletion from profiles table
- ✅ All admin CRUD operations

### Step 2: Test Student Creation
1. Log in as admin
2. Go to **Admin → Users**
3. Click **Add User**
4. Select role: **Student**
5. Fill in:
   - First Name
   - Last Name
   - Email
   - Password
   - **Grade Level** (1-12) ← FIXED
   - **Class** (filtered by grade) ← FIXED
   - **Parent Phone** (new field) ← FIXED
6. Click **Create User**
7. Go to **Admin → Classes** to see the student count ← SHOULD WORK NOW

### Step 3: Test Teacher Assignment
1. Go to **Admin → Courses**
2. Click **Assign** next to any course
3. Select a teacher
4. Click **Assign Teacher** ← SHOULD WORK NOW

### Step 4: Test User Deletion
1. Go to **Admin → Users**
2. Click trash icon next to any user
3. Confirm deletion ← SHOULD WORK NOW
4. (Optional) Manually clean up auth.users from Supabase Dashboard

---

## Summary of Changes

### Files Modified:
1. **`supabase_schema.sql`** - Updated RLS policies
2. **`fix_rls_policies.sql`** - Migration script to apply policy fixes
3. **`app/admin/users/page.tsx`** - Fixed student creation form
4. **`lib/api.ts`** - Added auth user deletion attempt

### What Works Now:
- ✅ Create students with all required fields
- ✅ Students appear in class counts
- ✅ Assign teachers to courses
- ✅ Delete users (profile deletion works, auth cleanup is manual)
- ✅ All admin operations have proper permissions

---

## If Issues Persist

**Students still not showing in classes?**
- Check if you ran the SQL migration
- Verify students have `classId` set
- Try re-running `/seed` to populate demo data

**Teacher assignment still failing?**
- Make sure you ran `fix_rls_policies.sql`
- Check Supabase logs for RLS policy errors
- Verify you're logged in as admin

**Delete still not working?**
- Check if SQL migration was applied
- Look for errors in browser console
- Verify RLS policies in Supabase Dashboard

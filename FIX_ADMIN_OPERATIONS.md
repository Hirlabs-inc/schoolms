# Fixing Admin Operations Issues

## Issues Identified

1. ❌ **Cannot assign teachers to courses** - RLS policy was too restrictive
2. ❌ **Students don't appear in classes** - Need to verify data seeding
3. ❌ **Delete doesn't work in users section** - Missing delete policy for admins

## Root Cause

The RLS (Row Level Security) policies were using `FOR ALL` which is a shorthand that doesn't always work correctly in Supabase. The policies needed to be split into explicit `INSERT`, `UPDATE`, and `DELETE` policies.

## Solution

### Step 1: Apply the RLS Policy Fix

You need to run the migration script in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `fix_rls_policies.sql`
5. Click **Run** or press `Ctrl+Enter`

This will:
- ✅ Drop all old restrictive policies
- ✅ Create new granular policies for INSERT, UPDATE, DELETE
- ✅ Allow admins to delete users (profiles)
- ✅ Allow admins to update courses (assign teachers)
- ✅ Allow admins to manage all student and teacher records

### Step 2: Verify Students Appear in Classes

After applying the migration, check if students are showing up:

1. Log in as admin (`admin@school.edu` / `admin123`)
2. Go to **Admin → Classes**
3. You should see student counts for each class

If students still don't appear:
- Go to **Admin → Users** and verify students exist
- Check that students have a `classId` assigned
- You may need to re-run the seed page at `/seed` to populate demo data

### Step 3: Test All Fixed Features

#### Test 1: Delete User
1. Go to **Admin → Users**
2. Click the trash icon next to any user
3. Confirm deletion
4. ✅ User should be deleted successfully

#### Test 2: Assign Teacher to Course
1. Go to **Admin → Courses**
2. Click **Assign** or **Reassign** next to any course
3. Select a teacher from the dropdown
4. Click **Assign Teacher**
5. ✅ Teacher should be assigned successfully

#### Test 3: View Students in Classes
1. Go to **Admin → Classes**
2. ✅ You should see student counts next to each class

## What Changed

### Before (Broken)
```sql
-- This didn't work properly
create policy "Courses manage by Admin" on public.courses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
```

### After (Fixed)
```sql
-- Explicit policies for each operation
create policy "Courses insertable by Admin" on public.courses for insert with check (...);
create policy "Courses updatable by Admin" on public.courses for update using (...);
create policy "Courses deletable by Admin" on public.courses for delete using (...);
```

## Additional Notes

- **Cascading Deletes**: When you delete a user (profile), the database will automatically delete their student/teacher records due to `ON DELETE CASCADE` in the schema
- **Session Preservation**: Creating new users no longer logs out the admin (fixed in previous update)
- **SMS Notifications**: The attendance system now sends SMS to parents of absent students (uses console logging by default, ready for Twilio integration)

## If Issues Persist

If you still experience issues after running the migration:

1. **Check Supabase Logs**: Go to Supabase Dashboard → Logs → Database to see any RLS policy errors
2. **Verify Admin Role**: Make sure your logged-in user has `role = 'ADMIN'` in the profiles table
3. **Clear Browser Cache**: Sometimes old sessions can cause issues
4. **Re-login**: Log out and log back in to refresh your session

## Need Help?

If you encounter any errors when running the migration script, please share:
- The error message from Supabase SQL Editor
- Which specific operation is still failing (delete, assign teacher, etc.)

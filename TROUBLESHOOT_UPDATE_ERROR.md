# Troubleshooting: "Failed to update user" Error

## The Error
```
Failed to update user {}
at handleSubmit (app/admin/users/page.tsx:187:15)
```

## Most Likely Cause

**You haven't run the RLS policy migration yet!**

The update is failing because the Supabase Row Level Security (RLS) policies don't allow admins to update users yet.

---

## ✅ Solution: Run the SQL Migration

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (in the left sidebar)

### Step 2: Run the Migration
1. Click **New Query**
2. Open the file `fix_rls_policies.sql` from your project
3. Copy ALL the contents
4. Paste into the Supabase SQL Editor
5. Click **Run** (or press `Ctrl+Enter`)

### Step 3: Verify Success
You should see a success message like:
```
Success. No rows returned
```

This means all the policies were updated successfully.

### Step 4: Test Again
1. Go back to your app
2. Try editing a user again
3. ✅ It should work now!

---

## What the Migration Does

The migration script:
- ✅ Drops old restrictive RLS policies
- ✅ Creates new policies that allow admins to UPDATE users
- ✅ Creates new policies that allow admins to UPDATE students/teachers
- ✅ Enables DELETE operations for admins
- ✅ Enables course teacher assignments

---

## Detailed Error Logging

I've added detailed logging to help diagnose issues. Check your browser console for:

```
Updating user profile: <user-id> { firstName, lastName, email }
Profile updated successfully
Updating student data: <user-id> { classId, academicYear, parentPhone }
Student data updated successfully
```

If you see an error at any step, it will tell you exactly which operation failed:
- `Failed to update profile` - Issue with profiles table
- `Failed to update student data` - Issue with students table  
- `Failed to update teacher data` - Issue with teachers table

---

## Common Issues

### Issue 1: "new row violates row-level security policy"
**Cause**: RLS policies not applied
**Fix**: Run `fix_rls_policies.sql` in Supabase SQL Editor

### Issue 2: "permission denied for table"
**Cause**: User doesn't have admin role
**Fix**: Check that you're logged in as admin (`role = 'ADMIN'` in profiles table)

### Issue 3: Empty error object `{}`
**Cause**: Network error or Supabase connection issue
**Fix**: 
- Check your internet connection
- Verify `.env.local` has correct Supabase credentials
- Check Supabase project is active (not paused)

### Issue 4: "Cannot find student/teacher record"
**Cause**: User exists in profiles but not in students/teachers table
**Fix**: This is a data integrity issue. You may need to:
1. Delete the user
2. Recreate them properly
3. Or manually add the missing student/teacher record in Supabase

---

## Quick Checklist

Before editing users, make sure:
- [ ] You've run `fix_rls_policies.sql` in Supabase
- [ ] You're logged in as an admin user
- [ ] Your Supabase project is active
- [ ] `.env.local` has correct credentials
- [ ] Browser console shows no network errors

---

## Still Not Working?

If you've run the migration and it's still failing:

1. **Check Browser Console** - Look for the detailed error logs
2. **Check Supabase Logs** - Go to Supabase Dashboard → Logs → Database
3. **Verify RLS Policies** - Go to Supabase Dashboard → Database → Tables → profiles → RLS Policies
   - You should see: "Profiles updatable by owner or admin"
4. **Check Your Role** - Go to Supabase Dashboard → Table Editor → profiles
   - Find your user and verify `role = 'ADMIN'`

Share the specific error message from the console for more help!

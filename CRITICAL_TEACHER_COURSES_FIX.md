# 🔴 CRITICAL: Teacher Cannot See Courses

## Problem Identified
From the debug panel:
- **User ID**: 8a29e239-6cde-4ccb-86b4-83ffdcb151df
- **User Name**: Teacher1 e
- **Total Courses Fetched**: **0** ❌
- **My Assigned Courses**: **0** ❌
- **Total Exams Fetched**: **0** ❌

From Admin Exams page:
- Mathematics (Grade 1) → **Assigned to Teacher1 e** ✅
- Science (Grade 1) → **Assigned to Teacher1 e** ✅
- English (Grade 1) → Unassigned

## Root Cause
The teacher's account **cannot read the `courses` table** from the database. This is a **Row Level Security (RLS)** issue.

## Solution Steps

### Step 1: Apply RLS Policies to Supabase

You need to run the `fix_rls_policies.sql` file in your Supabase SQL Editor:

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `fix_rls_policies.sql`
5. Paste and click **Run**

### Step 2: Verify RLS Policies

After running the SQL, verify the policies exist:

```sql
-- Check if the courses policy exists
SELECT * FROM pg_policies WHERE tablename = 'courses';
```

You should see a policy named **"Courses viewable by authenticated"**.

### Step 3: Clear Teacher's Session

Have the teacher:
1. **Log out** completely
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Log back in**
4. Go to **Teacher > Exams**
5. Check the debug panel again

### Step 4: Verify Data

After the teacher logs back in, the debug panel should show:
- **Total Courses Fetched**: Should be > 0 (at least 2 for Mathematics and Science)
- **My Assigned Courses**: Should be 2
- **Assigned Course IDs**: Should show the course IDs
- **Total Exams Fetched**: Should be 2

## Alternative: Manual Database Check

If the above doesn't work, check the database directly:

```sql
-- Check if courses exist
SELECT * FROM public.courses WHERE "teacherId" = '8a29e239-6cde-4ccb-86b4-83ffdcb151df';
```

This should return 2 rows (Mathematics and Science for Grade 1).

If it returns 0 rows, the teacher assignment wasn't saved properly. Go to **Admin > Courses** and reassign the teacher.

## Expected Result

After fixing:
- Debug panel shows courses fetched
- Exam dropdown is populated
- Teacher can select exams and enter results

## If Still Not Working

If the teacher still sees 0 courses after applying RLS policies:

1. Check if RLS is enabled on the courses table:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'courses';
```

2. If `rowsecurity` is `false`, enable it:
```sql
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
```

3. Then re-apply the policies from `fix_rls_policies.sql`

-- SQL Script to wipe all user-generated data but KEEP Classes and Courses

-- 1. Disable triggers temporarily to avoid foreign key conflicts (optional but safer)
SET session_replication_role = 'replica';

-- 2. Delete data from dependent tables first
DELETE FROM public.attendance;
DELETE FROM public.exam_results;
DELETE FROM public.exams;
DELETE FROM public.students;
DELETE FROM public.teachers;

-- 3. Delete from profiles (which cascades to nothing else in public schema, but is linked to auth.users)
DELETE FROM public.profiles;

-- 4. Delete from auth.users (This is the critical part to remove login accounts)
-- Note: You need permissions to delete from auth.users. If this fails, you might need to do it from the Supabase Dashboard > Authentication > Users.
DELETE FROM auth.users WHERE email NOT IN ('admin@school.edu'); -- Optional: Keep the admin if you want

-- 5. Re-enable triggers
SET session_replication_role = 'origin';

-- 6. Reset sequences if any (Supabase UUIDs don't usually need this, but good practice for serials)
-- (No serials in your schema, mostly UUIDs)

-- Confirmation
SELECT 'All user data wiped successfully. Classes and Courses preserved.' as status;

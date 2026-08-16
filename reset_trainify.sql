-- Reset database for Trainify Technology Training Institute
-- WARNING: This deletes ALL existing data

-- Delete existing data (order matters due to foreign keys)
delete from public.exam_results;
delete from public.exams;
delete from public.attendance;
delete from public.fees;
delete from public.payments;
delete from public.expenses;
delete from public.courses;
delete from public.students;
delete from public.teachers;
delete from public.classes;
delete from public.profiles;
delete from public.institution_settings;

-- Reset sequences if any (none used since we use UUIDs)
-- Note: auth.users still exists but profiles are cleared

-- Re-create schema objects (run migrate_trainify.sql next)
-- See migrate_trainify.sql for all required tables

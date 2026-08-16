-- Migration: Fix RLS Policies for Admin Operations
-- This script updates the RLS policies to fix:
-- 1. Admin cannot delete users
-- 2. Admin cannot assign teachers to courses
-- 3. Better granular control for all operations

-- First, drop all existing policies
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insertable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by owner or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insertable by owner or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles deletable by admin" ON public.profiles;

DROP POLICY IF EXISTS "Classes viewable by authenticated" ON public.classes;
DROP POLICY IF EXISTS "Classes manage by Admin" ON public.classes;
DROP POLICY IF EXISTS "Classes insertable by Admin" ON public.classes;
DROP POLICY IF EXISTS "Classes updatable by Admin" ON public.classes;
DROP POLICY IF EXISTS "Classes deletable by Admin" ON public.classes;

DROP POLICY IF EXISTS "Courses viewable by authenticated" ON public.courses;
DROP POLICY IF EXISTS "Courses manage by Admin" ON public.courses;
DROP POLICY IF EXISTS "Courses insertable by Admin" ON public.courses;
DROP POLICY IF EXISTS "Courses updatable by Admin" ON public.courses;
DROP POLICY IF EXISTS "Courses deletable by Admin" ON public.courses;

DROP POLICY IF EXISTS "Students viewable by permissions" ON public.students;
DROP POLICY IF EXISTS "Students manage by Admin" ON public.students;
DROP POLICY IF EXISTS "Students insertable by Admin" ON public.students;
DROP POLICY IF EXISTS "Students updatable by Admin" ON public.students;
DROP POLICY IF EXISTS "Students deletable by Admin" ON public.students;

DROP POLICY IF EXISTS "Teachers viewable by authenticated" ON public.teachers;
DROP POLICY IF EXISTS "Teachers manage by Admin" ON public.teachers;
DROP POLICY IF EXISTS "Teachers insertable by Admin" ON public.teachers;
DROP POLICY IF EXISTS "Teachers updatable by Admin" ON public.teachers;
DROP POLICY IF EXISTS "Teachers deletable by Admin" ON public.teachers;

DROP POLICY IF EXISTS "Attendance viewable by permissions" ON public.attendance;
DROP POLICY IF EXISTS "Attendance manage by Staff" ON public.attendance;
DROP POLICY IF EXISTS "Attendance update by Staff" ON public.attendance;
DROP POLICY IF EXISTS "Attendance delete by Staff" ON public.attendance;
DROP POLICY IF EXISTS "Attendance insertable by Staff" ON public.attendance;
DROP POLICY IF EXISTS "Attendance updatable by Staff" ON public.attendance;
DROP POLICY IF EXISTS "Attendance deletable by Staff" ON public.attendance;

DROP POLICY IF EXISTS "Exams viewable by authenticated" ON public.exams;
DROP POLICY IF EXISTS "Exams manage by Staff" ON public.exams;
DROP POLICY IF EXISTS "Exams insertable by Staff" ON public.exams;
DROP POLICY IF EXISTS "Exams updatable by Staff" ON public.exams;
DROP POLICY IF EXISTS "Exams deletable by Staff" ON public.exams;

DROP POLICY IF EXISTS "Exam Results viewable by permissions" ON public.exam_results;
DROP POLICY IF EXISTS "Exam Results manage by Staff" ON public.exam_results;
DROP POLICY IF EXISTS "Exam Results insertable by Staff" ON public.exam_results;
DROP POLICY IF EXISTS "Exam Results updatable by Staff" ON public.exam_results;
DROP POLICY IF EXISTS "Exam Results deletable by Staff" ON public.exam_results;

-- Now create the new policies

-- Profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Profiles updatable by owner or admin" ON public.profiles FOR UPDATE USING (
  auth.uid() = id 
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Profiles insertable by owner or admin" ON public.profiles FOR INSERT WITH CHECK (
  auth.uid() = id 
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Profiles deletable by admin" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Classes
CREATE POLICY "Classes viewable by authenticated" ON public.classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Classes insertable by Admin" ON public.classes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Classes updatable by Admin" ON public.classes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Classes deletable by Admin" ON public.classes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Courses
CREATE POLICY "Courses viewable by authenticated" ON public.courses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Courses insertable by Admin" ON public.courses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Courses updatable by Admin" ON public.courses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Courses deletable by Admin" ON public.courses FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Students
CREATE POLICY "Students viewable by permissions" ON public.students FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
  OR
  auth.uid() = id
);
CREATE POLICY "Students insertable by Admin" ON public.students FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Students updatable by Admin" ON public.students FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Students deletable by Admin" ON public.students FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Teachers
CREATE POLICY "Teachers viewable by authenticated" ON public.teachers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers insertable by Admin" ON public.teachers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Teachers updatable by Admin" ON public.teachers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Teachers deletable by Admin" ON public.teachers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Attendance
CREATE POLICY "Attendance viewable by permissions" ON public.attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
CREATE POLICY "Attendance insertable by Staff" ON public.attendance FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Attendance updatable by Staff" ON public.attendance FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Attendance deletable by Staff" ON public.attendance FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);

-- Exams
CREATE POLICY "Exams viewable by authenticated" ON public.exams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Exams insertable by Staff" ON public.exams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Exams updatable by Staff" ON public.exams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Exams deletable by Staff" ON public.exams FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);

-- Exam Results
CREATE POLICY "Exam Results viewable by permissions" ON public.exam_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
CREATE POLICY "Exam Results insertable by Staff" ON public.exam_results FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Exam Results updatable by Staff" ON public.exam_results FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);
CREATE POLICY "Exam Results deletable by Staff" ON public.exam_results FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'TEACHER'))
);

-- Institution Settings (JWT-based check — doesn't depend on profiles table)
DROP POLICY IF EXISTS "Settings viewable by authenticated" ON public.institution_settings;
DROP POLICY IF EXISTS "Settings insertable by Admin" ON public.institution_settings;
DROP POLICY IF EXISTS "Settings updatable by Admin" ON public.institution_settings;
DROP POLICY IF EXISTS "Settings upsertable by Admin" ON public.institution_settings;

CREATE POLICY "Settings viewable by authenticated" ON public.institution_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Settings upsertable by Admin" ON public.institution_settings FOR ALL USING (
  auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN'
);

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table public.profiles (
  "id" uuid references auth.users on delete cascade not null primary key,
  "email" text not null,
  "role" text not null check (role in ('ADMIN', 'TEACHER', 'STUDENT')),
  "firstName" text,
  "lastName" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create classes table
create table public.classes (
  "id" text primary key,
  "name" text not null,
  "gradeLevel" integer not null
);

-- Create courses table
create table public.courses (
  "id" text primary key,
  "name" text not null,
  "code" text not null,
  "classId" text references public.classes("id"),
  "teacherId" uuid references public.profiles("id")
);

-- Create students table
create table public.students (
  "id" uuid references public.profiles("id") on delete cascade not null primary key,
  "studentNumber" text not null,
  "enrollmentYear" integer not null,
  "classId" text references public.classes("id"),
  "academicYear" integer not null,
  "parentPhone" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create teachers table
create table public.teachers (
  "id" uuid references public.profiles("id") on delete cascade not null primary key,
  "staffId" text not null,
  "department" text,
  "specialization" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create exams table
create table public.exams (
  "id" uuid default uuid_generate_v4() primary key,
  "courseId" text references public.courses("id"),
  "term" text not null,
  "date" date not null,
  "totalMarks" integer not null,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create exam_results table
create table public.exam_results (
  "id" uuid default uuid_generate_v4() primary key,
  "examId" uuid references public.exams("id"),
  "studentId" uuid references public.students("id"),
  "marksObtained" integer not null,
  "grade" text,
  "remarks" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create attendance table
create table public.attendance (
  "id" uuid default uuid_generate_v4() primary key,
  "type" text not null check (type in ('STUDENT', 'TEACHER')),
  "studentId" uuid references public.students("id"),
  "teacherId" uuid references public.profiles("id"),
  "classId" text references public.classes("id"),
  "date" date not null,
  "status" text not null check (status in ('PRESENT', 'ABSENT', 'LATE', 'SICK')),
  "excuse" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.exams enable row level security;
alter table public.exam_results enable row level security;
alter table public.attendance enable row level security;

-- Policies

-- Profiles
-- Everyone can see profiles (needed for relationships)
create policy "Profiles viewable by authenticated" on public.profiles for select using (auth.role() = 'authenticated');
-- Only owner can update their own profile OR admin can update any profile
create policy "Profiles updatable by owner or admin" on public.profiles for update using (
  auth.uid() = id 
  OR 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
-- New users can insert their own profile (during signup) OR admin can insert
create policy "Profiles insertable by owner or admin" on public.profiles for insert with check (
  auth.uid() = id 
  OR 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
-- Only admin can delete profiles
create policy "Profiles deletable by admin" on public.profiles for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Classes & Courses
-- Viewable by everyone authenticated
create policy "Classes viewable by authenticated" on public.classes for select using (auth.role() = 'authenticated');
create policy "Courses viewable by authenticated" on public.courses for select using (auth.role() = 'authenticated');

-- Admin can insert/update/delete classes
create policy "Classes insertable by Admin" on public.classes for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Classes updatable by Admin" on public.classes for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Classes deletable by Admin" on public.classes for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Admin can insert/update/delete courses
create policy "Courses insertable by Admin" on public.courses for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Courses updatable by Admin" on public.courses for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Courses deletable by Admin" on public.courses for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Students
-- Admins and Teachers can view all students
-- Students can view their own record
create policy "Students viewable by permissions" on public.students for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
  OR
  auth.uid() = id
);
-- Only Admins can insert/update/delete students
create policy "Students insertable by Admin" on public.students for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Students updatable by Admin" on public.students for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Students deletable by Admin" on public.students for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Teachers
-- Viewable by all authenticated (to see who teaches a course)
create policy "Teachers viewable by authenticated" on public.teachers for select using (auth.role() = 'authenticated');
-- Only Admins can insert/update/delete teachers
create policy "Teachers insertable by Admin" on public.teachers for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Teachers updatable by Admin" on public.teachers for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Teachers deletable by Admin" on public.teachers for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Attendance
-- Admins and Teachers can view all attendance
-- Students can view their own attendance
create policy "Attendance viewable by permissions" on public.attendance for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
-- Admins and Teachers can insert/update/delete attendance
create policy "Attendance insertable by Staff" on public.attendance for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Attendance updatable by Staff" on public.attendance for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Attendance deletable by Staff" on public.attendance for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);

-- Exams
-- Viewable by all authenticated
create policy "Exams viewable by authenticated" on public.exams for select using (auth.role() = 'authenticated');
-- Manage by Admins and Teachers
create policy "Exams insertable by Staff" on public.exams for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Exams updatable by Staff" on public.exams for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Exams deletable by Staff" on public.exams for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);

-- Exam Results
-- Admins and Teachers can view all
-- Students can view their own
create policy "Exam Results viewable by permissions" on public.exam_results for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
-- Manage by Admins and Teachers
create policy "Exam Results insertable by Staff" on public.exam_results for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Exam Results updatable by Staff" on public.exam_results for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);
create policy "Exam Results deletable by Staff" on public.exam_results for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
);

-- Insert Initial Data (Classes)
insert into public.classes ("id", "name", "gradeLevel") values
('1', 'Grade 1', 1),
('2', 'Grade 2', 2),
('3', 'Grade 3', 3),
('4', 'Grade 4', 4),
('5', 'Grade 5', 5),
('6', 'Grade 6', 6),
('7', 'Grade 7', 7),
('8', 'Grade 8', 8),
('9', 'Grade 9', 9),
('10', 'Grade 10', 10),
('11', 'Grade 11', 11),
('12', 'Grade 12', 12);

-- Insert Initial Data (Courses)
-- Insert Initial Data (Courses)
-- We will generate courses for all classes based on the curriculum
-- Primary (Grades 1-8): Somali, Arabic, Islamic, Maths, Social, Science, English, Technology
-- Secondary (Grades 9-12): Biology, Chemistry, Physics, Geography, History, Technology, Business, Maths, Arabic, Islamic, Somali, English

DO $$
DECLARE
    class_record RECORD;
    subject text;
    primary_subjects text[] := ARRAY['Somali', 'Arabic', 'Islamic', 'Maths', 'Social', 'Science', 'English', 'Technology'];
    secondary_subjects text[] := ARRAY['Biology', 'Chemistry', 'Physics', 'Geography', 'History', 'Technology', 'Business', 'Maths', 'Arabic', 'Islamic', 'Somali', 'English'];
    course_code text;
BEGIN
    FOR class_record IN SELECT * FROM public.classes LOOP
        IF class_record."gradeLevel" <= 8 THEN
            FOREACH subject IN ARRAY primary_subjects LOOP
                course_code := UPPER(SUBSTRING(subject, 1, 3)) || '-' || class_record."id";
                INSERT INTO public.courses ("id", "name", "code", "classId")
                VALUES (uuid_generate_v4()::text, subject, course_code, class_record."id");
            END LOOP;
        ELSE
            FOREACH subject IN ARRAY secondary_subjects LOOP
                course_code := UPPER(SUBSTRING(subject, 1, 3)) || '-' || class_record."id";
                INSERT INTO public.courses ("id", "name", "code", "classId")
                VALUES (uuid_generate_v4()::text, subject, course_code, class_record."id");
            END LOOP;
        END IF;
    END LOOP;
END $$;

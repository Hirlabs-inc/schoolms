-- SQLite Schema for School Management System

-- Enable Foreign Keys
PRAGMA foreign_keys = ON;

-- Create auth_users table (Mirrors Supabase auth.users)
CREATE TABLE auth_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- For storing hashed passwords if migrating
  last_login TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create profiles table
CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT', 'SECRETARY', 'MANAGER')),
  firstName TEXT,
  lastName TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create classes table
CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gradeLevel INTEGER NOT NULL
);

-- Create courses table
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  classId TEXT REFERENCES classes(id),
  teacherId TEXT REFERENCES profiles(id),
  fee REAL NOT NULL DEFAULT 0,
  duration TEXT,
  commissionRate REAL NOT NULL DEFAULT 0
);

-- Create students table
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  studentNumber TEXT NOT NULL,
  enrollmentYear INTEGER NOT NULL,
  classId TEXT REFERENCES classes(id),
  academicYear INTEGER NOT NULL,
  parentPhone TEXT,
  courseId TEXT REFERENCES courses(id),
  phone TEXT,
  gender TEXT,
  admissionDate TEXT,
  expectedCompletionDate TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'DROPPED')),
  profileId TEXT REFERENCES profiles(id),
  email TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create teachers table
CREATE TABLE teachers (
  id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  staffId TEXT NOT NULL,
  department TEXT,
  specialization TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create exams table
CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  courseId TEXT REFERENCES courses(id),
  term TEXT NOT NULL,
  date TEXT NOT NULL,
  totalMarks INTEGER NOT NULL,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create exam_results table
CREATE TABLE exam_results (
  id TEXT PRIMARY KEY,
  examId TEXT REFERENCES exams(id),
  studentId TEXT REFERENCES students(id),
  marksObtained INTEGER NOT NULL,
  grade TEXT,
  remarks TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Create attendance table
CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('STUDENT', 'TEACHER')),
  studentId TEXT REFERENCES students(id),
  teacherId TEXT REFERENCES profiles(id),
  classId TEXT REFERENCES classes(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'SICK')),
  excuse TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) NOT NULL
);

-- Insert Initial Data (Classes)
INSERT INTO classes (id, name, gradeLevel) VALUES
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

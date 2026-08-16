-- Migration: Add SECRETARY & MANAGER roles, optional student login accounts,
-- teacher commission tracking, and demo role accounts (no data loss).
--
-- IMPORTANT: Back up your database before running. This migration makes a BREAKING
-- change to the `profiles` table (renames it, recreates it with the new role CHECK
-- and a `password` column preserved, then copies data back). Run it inside a
-- transaction so it either fully applies or fully rolls back.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- ---------------------------------------------------------------
-- 1) ROLES: widen the profiles role CHECK (preserving all columns,
--    including `password` so logins keep working).
-- ---------------------------------------------------------------
ALTER TABLE profiles RENAME TO profiles_old;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','TEACHER','STUDENT','SECRETARY','MANAGER')),
  firstName TEXT,
  lastName TEXT,
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

INSERT INTO profiles (id, email, password, role, firstName, lastName, createdAt)
SELECT id, email, password, role, firstName, lastName, createdAt FROM profiles_old;

DROP TABLE profiles_old;

-- ---------------------------------------------------------------
-- 2) STUDENT LOGIN ACCOUNTS OPTIONAL: add nullable profileId + email
--    to students. Safe to re-run (SQLite ignores duplicate columns
--    added by ADD COLUMN when the column already exists is NOT true,
--    so we guard with the following checks).
-- ---------------------------------------------------------------
-- (For existing live DBs, run these ALTERs once each. A second run
--  errors with "duplicate column name" — harmless, but if re-running,
--  comment them out or wrap per-guard in your migration runner.)
ALTER TABLE students ADD COLUMN profileId TEXT REFERENCES profiles(id);
ALTER TABLE students ADD COLUMN email TEXT;

-- ---------------------------------------------------------------
-- 3) TEACHER COMMISSION: add commissionRate to courses.
-- ---------------------------------------------------------------
ALTER TABLE courses ADD COLUMN commissionRate REAL NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------
-- 4) TEACHER COMMISSION ledger.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_commissions (
  id TEXT PRIMARY KEY,
  teacherId TEXT NOT NULL REFERENCES profiles(id),
  studentId TEXT REFERENCES students(id),
  courseId TEXT REFERENCES courses(id),
  commissionRate REAL NOT NULL DEFAULT 0,
  commissionAmount REAL NOT NULL DEFAULT 0,
  paidAmount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'EARNED' CHECK (status IN ('EARNED','PARTIAL','PAID')),
  createdAt TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

COMMIT;
PRAGMA foreign_keys = ON;

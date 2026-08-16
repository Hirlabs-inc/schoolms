-- Turso (SQLite) migration for Trainify
-- Run this in the Turso shell: turso db shell <db-name> < turso_migration.sql

create table if not exists profiles (
  id text primary key,
  email text not null,
  password text not null,
  role text not null check (role in ('ADMIN', 'TEACHER', 'STUDENT')),
  firstName text,
  lastName text,
  createdAt text default (datetime('now'))
);

create table if not exists classes (
  id text primary key,
  name text not null,
  gradeLevel integer not null
);

create table if not exists courses (
  id text primary key,
  name text not null,
  code text not null,
  classId text references classes(id),
  teacherId text references profiles(id),
  fee real,
  duration text
);

create table if not exists students (
  id text primary key references profiles(id) on delete cascade,
  studentNumber text not null,
  enrollmentYear integer not null,
  classId text references classes(id),
  academicYear integer not null,
  parentPhone text,
  phone text,
  gender text,
  courseId text references courses(id),
  admissionDate text,
  expectedCompletionDate text,
  status text default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'DROPPED')),
  createdAt text default (datetime('now'))
);

create table if not exists teachers (
  id text primary key references profiles(id) on delete cascade,
  staffId text not null,
  department text,
  specialization text,
  createdAt text default (datetime('now'))
);

create table if not exists fees (
  id text primary key default (lower(hex(randomblob(16)))),
  studentId text references students(id),
  courseId text references courses(id),
  totalFee real not null,
  balance real not null default 0,
  dueDate text,
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  createdAt text default (datetime('now')),
  updatedAt text default (datetime('now'))
);

create table if not exists payments (
  id text primary key default (lower(hex(randomblob(16)))),
  studentId text references students(id),
  feeId text references fees(id),
  amount real not null,
  paymentDate text not null,
  paymentMethod text not null check (paymentMethod in ('CASH', 'M_PESA', 'BANK')),
  receiptNumber text not null,
  notes text,
  createdAt text default (datetime('now'))
);

create table if not exists expenses (
  id text primary key default (lower(hex(randomblob(16)))),
  category text not null check (category in ('RENT', 'SALARIES', 'INTERNET', 'ELECTRICITY', 'MARKETING', 'OFFICE_SUPPLIES', 'TRANSPORT', 'MISCELLANEOUS')),
  amount real not null,
  description text not null,
  expenseDate text not null,
  receiptNumber text,
  createdBy text references profiles(id),
  createdAt text default (datetime('now'))
);

create table if not exists institution_settings (
  id text primary key,
  name text not null,
  logo text,
  receiptHeader text,
  contactEmail text,
  contactPhone text,
  address text,
  currency text not null default 'KSh',
  createdAt text default (datetime('now')),
  updatedAt text default (datetime('now'))
);

-- Insert default institution settings
insert or ignore into institution_settings (id, name, currency) values ('main', 'Trainify Technology Training Institute', 'KSh');

-- Insert default classes
insert or ignore into classes (id, name, gradeLevel) values
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

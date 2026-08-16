-- Supplemental migration: Payroll, Income, Enrollment Progress
-- Run after the main migration

-- Income tracking (non-fee revenue sources)
create table if not exists income (
  id text primary key default (lower(hex(randomblob(16)))),
  category text not null check (category in ('FEES', 'GRANTS', 'DONATIONS', 'OTHER')),
  amount real not null,
  description text not null,
  incomeDate text not null,
  receiptNumber text,
  createdBy text references profiles(id),
  createdAt text default (datetime('now'))
);

-- Teacher compensation contracts
create table if not exists teacher_contracts (
  id text primary key default (lower(hex(randomblob(16)))),
  teacherId text not null references profiles(id),
  compensationType text not null check (compensationType in ('SALARY', 'COMMISSION')),
  salaryAmount real,
  commissionRate real,
  commissionPerStudent real,
  bankName text,
  bankAccount text,
  bankCode text,
  taxId text,
  startDate text,
  endDate text,
  status text default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  createdAt text default (datetime('now'))
);

-- Payroll disbursement records
create table if not exists payroll_records (
  id text primary key default (lower(hex(randomblob(16)))),
  teacherId text not null references profiles(id),
  contractId text references teacher_contracts(id),
  amount real not null,
  periodStart text not null,
  periodEnd text not null,
  payDate text not null,
  payType text not null check (payType in ('SALARY', 'COMMISSION')),
  notes text,
  status text default 'PAID' check (status in ('PAID', 'PENDING', 'CANCELLED')),
  createdAt text default (datetime('now'))
);

-- Enrollment progress tracking per student per course
create table if not exists enrollment_progress (
  id text primary key default (lower(hex(randomblob(16)))),
  studentId text not null references students(id),
  courseId text not null references courses(id),
  progressPercent integer default 0 check (progressPercent >= 0 and progressPercent <= 100),
  status text default 'ENROLLED' check (status in ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED')),
  startDate text,
  completionDate text,
  notes text,
  updatedAt text default (datetime('now')),
  createdAt text default (datetime('now'))
);

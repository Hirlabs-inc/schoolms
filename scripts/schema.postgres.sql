-- Postgres schema for the school-management-system.
--
-- Columns are lowercase (Postgres folds unquoted identifiers to lowercase).
-- The app's DB adapter (lib/turso.ts) rewrites camelCase quoted identifiers
-- to lowercase and maps result keys back to camelCase, so the schema here is
-- deliberately all-lowercase.

create table if not exists profiles (
  id text primary key,
  email text not null unique,
  password text not null,
  role text not null,
  firstname text,
  lastname text,
  resettoken text,
  resettokenexpiry text,
  createdat text default (now()::text)
);

create table if not exists classes (
  id text primary key,
  name text,
  gradelevel integer
);

create table if not exists teachers (
  id text primary key,
  staffid text,
  department text,
  specialization text,
  firstname text,
  lastname text
);

create table if not exists courses (
  id text primary key,
  name text,
  code text,
  classid text references classes(id),
  teacherid text references teachers(id),
  fee numeric,
  duration text,
  commissionrate numeric
);

create table if not exists students (
  id text primary key,
  studentnumber text not null,
  enrollmentyear integer not null,
  classid text references classes(id),
  academicyear integer not null,
  parentphone text,
  phone text,
  gender text,
  courseid text references courses(id),
  admissiondate text,
  expectedcompletiondate text,
  status text default 'ACTIVE',
  createdat text default (now()::text),
  profileid text references profiles(id),
  email text,
  firstname text,
  lastname text
);

create table if not exists exams (
  id text primary key,
  courseid text references courses(id),
  term text,
  date text,
  totalmarks numeric
);

create table if not exists exam_results (
  id text primary key,
  examid text references exams(id),
  studentid text references students(id),
  marksobtained numeric,
  grade text,
  remarks text
);

create table if not exists attendance (
  id text primary key,
  type text,
  studentid text references students(id),
  teacherid text references teachers(id),
  classid text references classes(id),
  date text,
  status text,
  excuse text
);

create table if not exists fees (
  id text primary key,
  studentid text references students(id),
  courseid text references courses(id),
  totalfee numeric,
  balance numeric,
  duedate text,
  status text,
  createdat text default (now()::text),
  updatedat text
);

create table if not exists payments (
  id text primary key,
  studentid text references students(id),
  feeid text references fees(id),
  amount numeric,
  paymentdate text,
  paymentmethod text,
  receiptnumber text,
  notes text,
  createdby text,
  createdat text default (now()::text)
);

create table if not exists expenses (
  id text primary key,
  category text,
  amount numeric,
  description text,
  expensedate text,
  receiptnumber text,
  createdby text,
  createdat text default (now()::text)
);

create table if not exists income (
  id text primary key,
  category text,
  amount numeric,
  description text,
  incomedate text,
  receiptnumber text,
  createdby text,
  createdat text default (now()::text)
);

create table if not exists teacher_contracts (
  id text primary key,
  teacherid text references teachers(id),
  compensationtype text,
  commissionrate numeric,
  commissionperstudent numeric,
  salaryamount numeric,
  bankname text,
  bankaccount text,
  bankcode text,
  taxid text,
  startdate text,
  enddate text,
  status text,
  createdat text default (now()::text)
);

create table if not exists payroll_records (
  id text primary key,
  teacherid text references teachers(id),
  contractid text references teacher_contracts(id),
  amount numeric,
  periodstart text,
  periodend text,
  paydate text,
  paytype text,
  notes text,
  status text,
  createdat text default (now()::text)
);

create table if not exists teacher_commissions (
  id text primary key,
  teacherid text references teachers(id),
  studentid text references students(id),
  courseid text references courses(id),
  commissionrate numeric,
  commissionamount numeric,
  paidamount numeric,
  status text,
  createdat text default (now()::text)
);

create table if not exists enrollment_progress (
  id text primary key,
  studentid text references students(id),
  courseid text references courses(id),
  progresspercent numeric,
  status text,
  startdate text,
  completiondate text,
  notes text,
  updatedat text,
  createdat text default (now()::text)
);

create table if not exists course_teachers (
  courseid text references courses(id),
  teacherid text references teachers(id),
  createdat text default (now()::text),
  primary key (courseid, teacherid)
);

create table if not exists institution_settings (
  id text primary key,
  name text,
  currency text,
  receiptheader text,
  contactemail text,
  contactphone text,
  address text,
  logo text,
  createdat text default (now()::text),
  updatedat text
);

-- Role-based access control (RBAC).
-- Each row grants (or denies) a named permission to a role.
-- When no row exists for (role, permission) the default from
-- DEFAULT_ROLE_PERMISSIONS is the fallback — this lets the admin
-- fine-tune access per role without touching code.
create table if not exists role_permissions (
  role text not null,
  permission text not null,
  granted boolean not null default true,
  primary key (role, permission)
);
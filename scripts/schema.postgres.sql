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

-- Finance extensions: a charge can be a COURSE fee, a one-off REGISTRATION
-- fee, or an OTHER charge. grossamount is the list price, discountamount the
-- reduction, taxamount the VAT/sales tax, and totalfee the net payable
-- (gross - discount + tax). All are idempotent so existing databases upgrade
-- in place when scripts/schema.postgres.sql is re-applied.
alter table fees add column if not exists feetype text default 'COURSE';
alter table fees add column if not exists grossamount numeric;
alter table fees add column if not exists discountamount numeric default 0;
alter table fees add column if not exists discountreason text;
alter table fees add column if not exists taxamount numeric default 0;
alter table fees add column if not exists description text;

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

-- Finance configuration: a one-off registration/admission fee charged when a
-- student first enrolls, and an optional tax/VAT rate (percent) applied to
-- every charge. Idempotent for existing databases.
alter table institution_settings add column if not exists registrationfee numeric default 0;
alter table institution_settings add column if not exists taxrate numeric default 0;

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

-- Indexes for the columns the app filters/joins on most. Postgres does not
-- index foreign keys automatically, so these are important for query speed as
-- data grows. Idempotent, so re-applying the schema is safe.
create index if not exists idx_fees_student           on fees (studentid);
create index if not exists idx_fees_course            on fees (courseid);
create index if not exists idx_fees_type              on fees (feetype);
create index if not exists idx_payments_student       on payments (studentid);
create index if not exists idx_payments_fee           on payments (feeid);
create index if not exists idx_payments_receipt       on payments (receiptnumber);
create index if not exists idx_enrollment_student     on enrollment_progress (studentid);
create index if not exists idx_enrollment_course      on enrollment_progress (courseid);
create index if not exists idx_commissions_teacher    on teacher_commissions (teacherid);
create index if not exists idx_commissions_student    on teacher_commissions (studentid);
create index if not exists idx_commissions_course     on teacher_commissions (courseid);
create index if not exists idx_students_course        on students (courseid);
create index if not exists idx_students_profile       on students (profileid);
create index if not exists idx_attendance_student     on attendance (studentid);
create index if not exists idx_attendance_teacher     on attendance (teacherid);
create index if not exists idx_exam_results_student   on exam_results (studentid);
create index if not exists idx_exam_results_exam      on exam_results (examid);
create index if not exists idx_income_receipt         on income (receiptnumber);
create index if not exists idx_courses_teacher        on courses (teacherid);
create index if not exists idx_courses_class          on courses (classid);
create index if not exists idx_payroll_teacher        on payroll_records (teacherid);
create index if not exists idx_course_teachers_teacher on course_teachers (teacherid);
create index if not exists idx_role_permissions_role  on role_permissions (role);
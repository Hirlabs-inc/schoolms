-- Trainify Technology Training Institute - Migration
-- Adds financial tracking tables for fee management, expenses, and reporting

-- 1. Institution Settings
create table if not exists public.institution_settings (
  "id" text primary key default 'main',
  "name" text not null default 'Trainify Technology Training Institute',
  "logo" text,
  "receiptHeader" text,
  "contactEmail" text,
  "contactPhone" text,
  "address" text,
  "currency" text not null default 'KES',
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Fees (assigned course fees per student)
create table if not exists public.fees (
  "id" uuid default uuid_generate_v4() primary key,
  "studentId" uuid references public.students("id") on delete cascade,
  "courseId" text references public.courses("id"),
  "totalFee" numeric(10,2) not null,
  "balance" numeric(10,2) not null,
  "dueDate" date,
  "status" text not null default 'PENDING' check ("status" in ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updatedAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Payments
create table if not exists public.payments (
  "id" uuid default uuid_generate_v4() primary key,
  "studentId" uuid references public.students("id") on delete cascade,
  "feeId" uuid references public.fees("id") on delete cascade,
  "amount" numeric(10,2) not null,
  "paymentDate" date not null,
  "paymentMethod" text not null check ("paymentMethod" in ('CASH', 'M_PESA', 'BANK')),
  "receiptNumber" text not null,
  "notes" text,
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Expenses
create table if not exists public.expenses (
  "id" uuid default uuid_generate_v4() primary key,
  "category" text not null check ("category" in ('RENT', 'SALARIES', 'INTERNET', 'ELECTRICITY', 'MARKETING', 'OFFICE_SUPPLIES', 'TRANSPORT', 'MISCELLANEOUS')),
  "amount" numeric(10,2) not null,
  "description" text not null,
  "expenseDate" date not null,
  "receiptNumber" text,
  "createdBy" uuid references public.profiles("id"),
  "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add fee and duration columns to courses
alter table public.courses add column if not exists "fee" numeric(10,2);
alter table public.courses add column if not exists "duration" text;

-- Add phone, gender, courseId, admissionDate, expectedCompletionDate, status to students
alter table public.students add column if not exists "phone" text;
alter table public.students add column if not exists "gender" text;
alter table public.students add column if not exists "courseId" text references public.courses("id");
alter table public.students add column if not exists "admissionDate" date;
alter table public.students add column if not exists "expectedCompletionDate" date;
alter table public.students add column if not exists "status" text default 'ACTIVE' check ("status" in ('ACTIVE', 'COMPLETED', 'DROPPED'));

-- RLS Policies
alter table public.institution_settings enable row level security;
alter table public.fees enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

-- Institution settings: Admin only (JWT-based check)
drop policy if exists "Settings viewable by authenticated" on public.institution_settings;
drop policy if exists "Settings insertable by Admin" on public.institution_settings;
drop policy if exists "Settings updatable by Admin" on public.institution_settings;
drop policy if exists "Settings upsertable by Admin" on public.institution_settings;
create policy "Settings viewable by authenticated" on public.institution_settings for select using (auth.role() = 'authenticated');
create policy "Settings upsertable by Admin" on public.institution_settings for all using (
  auth.jwt() -> 'user_metadata' ->> 'role' = 'ADMIN'
);

-- Fees: Admins and Teachers can view, Admin only for insert/update/delete
drop policy if exists "Fees viewable by staff" on public.fees;
drop policy if exists "Fees insertable by Admin" on public.fees;
drop policy if exists "Fees updatable by Admin" on public.fees;
drop policy if exists "Fees deletable by Admin" on public.fees;
create policy "Fees viewable by staff" on public.fees for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
create policy "Fees insertable by Admin" on public.fees for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Fees updatable by Admin" on public.fees for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Fees deletable by Admin" on public.fees for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Payments: Admins and Teachers can view, Admin only for insert/update/delete
drop policy if exists "Payments viewable by staff" on public.payments;
drop policy if exists "Payments insertable by Admin" on public.payments;
drop policy if exists "Payments updatable by Admin" on public.payments;
drop policy if exists "Payments deletable by Admin" on public.payments;
create policy "Payments viewable by staff" on public.payments for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('ADMIN', 'TEACHER'))
  OR
  "studentId" = auth.uid()
);
create policy "Payments insertable by Admin" on public.payments for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Payments updatable by Admin" on public.payments for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Payments deletable by Admin" on public.payments for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Expenses: Viewable by all authenticated, Admin only for insert/update/delete
drop policy if exists "Expenses viewable by authenticated" on public.expenses;
drop policy if exists "Expenses insertable by Admin" on public.expenses;
drop policy if exists "Expenses updatable by Admin" on public.expenses;
drop policy if exists "Expenses deletable by Admin" on public.expenses;
create policy "Expenses viewable by authenticated" on public.expenses for select using (auth.role() = 'authenticated');
create policy "Expenses insertable by Admin" on public.expenses for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Expenses updatable by Admin" on public.expenses for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Expenses deletable by Admin" on public.expenses for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
);

-- Insert default institution settings
insert into public.institution_settings ("id", "name", "currency")
values ('main', 'Trainify Technology Training Institute', 'KES')
on conflict ("id") do nothing;

-- Insert sample courses for a training institute
insert into public.courses ("id", "name", "code", "fee", "duration") values
  ('web-dev', 'Web Development', 'WD-101', 25000, '3 months'),
  ('mobile-dev', 'Mobile App Development', 'MD-101', 30000, '3 months'),
  ('graphic-design', 'Graphic Design', 'GD-101', 20000, '2 months'),
  ('data-science', 'Data Science', 'DS-101', 35000, '4 months'),
  ('network-admin', 'Network Administration', 'NA-101', 28000, '3 months'),
  ('cybersecurity', 'Cybersecurity', 'CS-101', 32000, '4 months'),
  ('python-prog', 'Python Programming', 'PY-101', 22000, '2 months'),
  ('digital-marketing', 'Digital Marketing', 'DM-101', 18000, '2 months'),
  ('ui-ux-design', 'UI/UX Design', 'UX-101', 25000, '3 months'),
  ('database-mgmt', 'Database Management', 'DB-101', 28000, '3 months')
on conflict ("id") do nothing;

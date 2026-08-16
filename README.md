# Trainify Technology Training Institute — School Management System

A production-ready school management web application for training institutes.
It covers the full student lifecycle: enrollment, course assignment, fee tracking
with automated overdue highlighting, teacher payroll & commission, expenses/income,
progress reporting, and role-based access for Admin, Manager, Secretary, Teacher, and Student.

## Features

- **Student Management** — register students (optional login account), assign to courses, track progress.
- **Course Management** — courses with fees, assigned teachers, and commission rates.
- **Fee Tracking** — per-student summary: total fee, amount paid, remaining balance, next due date,
  full payment history. Overdue balances are highlighted automatically.
- **Teacher Commission** — per-teacher: students assigned, total commission earned, amount paid,
  remaining balance, and a "Pay Commission" action. Commission is generated automatically on enrollment.
- **Payroll** — salary and commission contracts for teachers.
- **Finance** — expenses, income, and outstanding-balance dashboards.
- **Progress Reports** — enrollment progress per student/course.
- **Multi-role access** — Admin, Manager, Secretary, Teacher, Student, each with appropriate permissions.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Turso (libSQL / SQLite)
- **Auth:** JWT (jose) + bcrypt password hashing
- **Tests:** Vitest

## Prerequisites

- Node.js 18+ and npm
- A Turso database URL + auth token (or a local libSQL file)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000 (or :3001 if 3000 is busy)
```

### Environment variables (`.env.local`, server-only)

| Variable | Purpose |
|----------|---------|
| `TURSO_URL` | libSQL/Turso database URL (e.g. `libsql://xxx.turso.io` or `file:./dev.db`) |
| `TURSO_TOKEN` | Turso auth token |
| `JWT_SECRET` | Long random string used to sign auth tokens. **Required in production.** |
| `NEXT_PUBLIC_TEXTBEE_API_KEY` | (Optional) SMS provider key for notifications |

## Build & Run (production)

```bash
npm run build
npm run start
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | ESLint |
| `npm test` | Run the Vitest suite |

## Project Structure

```
app/            Next.js App Router pages (admin, teacher, student, auth, api)
components/     UI components (shadcn/ui)
contexts/       React context providers (auth)
lib/            Data layer, auth, types, API helpers
lib/__tests__/  Vitest test suite
```

## Roles & Permissions

| Role | Access |
|------|--------|
| ADMIN | Full access to all modules |
| MANAGER | Full access except Users/Settings management |
| SECRETARY | Students, Fees, Payroll (view), Progress |
| TEACHER | Teacher portal (own courses, attendance, progress) |
| STUDENT | Student portal (own courses, results, progress) |

## Security Notes

- Authentication uses signed JWTs; the secret (`JWT_SECRET`) is required in production and must never be committed.
- All database access from the browser goes through a server-side proxy (`/api/db`) that verifies the JWT
  and enforces a server-side SQL policy (no arbitrary SQL, no DDL, no privilege escalation).
- All queries are parameterized (no string interpolation of user input).
- Login is rate-limited (5 attempts / 15 min per email+IP) and validates input.
- `.env.local` and `*.pem` are gitignored.

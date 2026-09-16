# Rollbook 📚

> Modern, privacy-focused college attendance tracking, bunk planning, and credit management application built on TanStack Start, React 19, Tailwind CSS, Better Auth, and dual-mode PostgreSQL (Embedded PGLite & Cloud Neon).

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [1. Dashboard & Quick Mark](#1-dashboard--quick-mark)
  - [2. Timetable & Schedule Management](#2-timetable--schedule-management)
  - [3. Intelligent Attendance & Bunk Intelligence](#3-intelligent-attendance--bunk-intelligence)
  - [4. Teacher Credit System](#4-teacher-credit-system)
  - [5. Visual Analytics & Calendar](#5-visual-analytics--calendar)
  - [6. Data Portability & Settings](#6-data-portability--settings)
- [System Architecture](#system-architecture)
  - [High-Level Architecture Diagram](#high-level-architecture-diagram)
  - [Directory Structure](#directory-structure)
  - [Core Tech Stack](#core-tech-stack)
- [Database Schema & Migrations](#database-schema--migrations)
  - [Dual-Mode Database Engine (PGLite & Neon)](#dual-mode-database-engine-pglite--neon)
  - [Data Model & Entities](#data-model--entities)
- [Attendance & Bunk Algorithms](#attendance--bunk-algorithms)
  - [Mathematical Formulations](#mathematical-formulations)
- [Authentication & Security](#authentication--security)
- [Getting Started & Development](#getting-started--development)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation & Running](#installation--running)
  - [Available Scripts](#available-scripts)
- [Deployment](#deployment)

---

## Overview

**Rollbook** is designed specifically for college and university students managing attendance percentage requirements (e.g., 75% or 80% threshold). Unlike generic tracker apps, Rollbook factors in real-world academic dynamics:

- **Timetable-driven sessions** with period numbers, time slots, day-of-week slots, and per-slot teacher allocations.
- **Multi-teacher support** — each period slot can have its own teacher override on top of the subject's default faculty.
- **Teacher credit allowances** (compensatory attendance for assignments, notes, lab work, or departmental projects).
- **Exact bunk calculations** ("How many classes can I safely miss without dropping below threshold?").
- **Recovery calculations** ("How many consecutive classes must I attend to recover my standing?").
- **Routine archiving** — when the college changes the timetable mid-semester, archive the old routine and start fresh while keeping all historical attendance data intact.
- **Offline-ready and zero-setup local storage** using **PGLite** (Postgres in WASM) when running locally or in development, with frictionless migration to **Neon Serverless PostgreSQL** in production.

---

## Key Features

### 1. Dashboard & Quick Mark
- **Context-Aware Mark Pad**: Displays today's scheduled classes according to day-of-week. Mark periods instantly as:
  - `Present` (counts towards attended and hosted)
  - `Absent` (counts towards hosted, impacts percentage)
  - `Holiday` (excluded from hosted tally)
  - `Cancelled` (excluded from hosted tally)
- **Live Threshold Ring**: Visual gauge showing current raw attendance vs. effective attendance (incorporating credits).
- **Metric Highlights**:
  - Total Classes Hosted, Present, and Absent.
  - Safe Bunk Allowance ($B$).
  - Classes needed to recover ($N_{\text{attend}}$).

### 2. Timetable & Schedule Management
- **Semester Structure**: Organize academic sessions with start dates, course name, semester title, and active flags.
- **Dynamic Weekly Timetable**:
  - Configure recurring classes by weekday (Monday–Saturday).
  - Slot by period number, start time, end time.
  - Per-slot teacher override — different faculty for the same subject on different days is fully supported.
  - Conflict prevention and unique indexing over `(user_id, semester_id, day_of_week, period_number)`.
- **Manage periods from the subject page**: Add, edit, or delete individual period slots directly from the subject detail view — no need to navigate to the Routine tab.
- **Routine Archiving**: When the college changes the schedule mid-semester, use _Archive routine & start fresh_ to:
  - Mark the current semester as archived (attendance history preserved).
  - Create a new active semester with all subjects copied over (codes, teachers, and notes intact).
  - Start with a blank timetable and add the updated periods.
- **Active / Closed Semesters**: Archive past semesters while retaining all historical attendance data.

### 3. Intelligent Attendance & Bunk Intelligence
- **Threshold Enforcement**: Customizable threshold percentage (default: 75%).
- **Raw vs. Effective Attendance**:
  - **Raw %**: Represents actual physical presence $\frac{\text{Present}}{\text{Hosted}} \times 100$.
  - **Effective %**: Adjusts for academic credits $\frac{\text{Present} + \text{Credits}}{\text{Hosted}} \times 100$.
- **Predictive Calculations**:
  - Automatically calculates whether a student is "In the Clear" or "At Risk".
  - Predicts new percentage for next mark (e.g., if you attend or miss next class).

### 4. Teacher Credit System
- **Academic Grace Credits**: Teachers often grant compensatory attendance for extracurriculars, project completions, or assignment submissions.
- **Granular Credit Types**:
  - `notes` — Class notes transcription / sharing
  - `assignment` — Timely assignment submission bonus
  - `project` — Lab, hackathon, or capstone deliverables
  - `other` — Discretionary attendance grants
- **Audit Trail**: Every credit record tracks granting teacher, date granted, point value, and optional context note.

### 5. Visual Analytics & Calendar
- **Interactive Calendar View**: Month-by-month grid displaying daily attendance states.
- **Subject-Specific Deep Dives**: Click any subject card to open a full detail view showing:
  - Subject code, all assigned teachers (default + per-slot overrides), and optional description/notes.
  - **Class schedule** grouped by day — every period listed with its time range and teacher, with inline edit and delete.
  - Add new period slots directly from the subject page.
  - Cumulative attendance percentage with bunk / recovery metrics.
  - Full colour-coded attendance history (present / absent / not held).
  - List of assigned teacher credits.
- **Per-subject completion toggle**: Mark individual subjects as "no more classes" — directly on the subject list card or inside the detail page — without closing the whole semester. Completed subjects are visually dimmed with a strikethrough.

### 6. Data Portability & Settings
- **JSON Snapshot Export**: Download complete user data (profile, semesters, timetable, marks, credits) in one portable JSON file.
- **Snapshot Import / Restore**: Seamless migration across browsers or test devices without data loss.
- **Profile & Threshold Configuration**: Adjust student ID, college name, and target attendance percentage on the fly.

---

## System Architecture

### High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              Browser (Client)                           |
|  - React 19 + TanStack Router (File-based routing)                     |
|  - Tailwind CSS + Lucide Icons + Sonner (Toasts)                        |
|  - State: TanStack Query + Local React Hooks                            |
+-------------------------------------------------------------------------+
                                     |
                       HTTP / Server Actions (RPC)
                                     |
+-------------------------------------------------------------------------+
|                        TanStack Start Server Layer                      |
|  - Server Functions (`createServerFn`)                                  |
|  - Auth Middleware & Session Isolation (`authMiddleware`)               |
|  - Better Auth Gateway (`/api/auth/*`)                                  |
+-------------------------------------------------------------------------+
                                     |
                     Unified Database Abstraction (`Sql`)
                                     |
         +---------------------------+---------------------------+
         |                                                       |
  [Development / Preview]                                  [Production]
         v                                                       v
+-----------------------------+               +-----------------------------+
|    Embedded WASM PGLite     |               |      Neon PostgreSQL        |
|  - Zero config, in-memory   |               |  - Scalable serverless DB   |
|  - Auto-applied migrations  |               |  - Connection pooling       |
+-----------------------------+               +-----------------------------+
```

### Directory Structure

```
Rollbook/
├── migrations/                     # SQL migration files
│   ├── 0001_auth.sql              # Better Auth tables (camelCase schema)
│   ├── 0002_rollbook.sql          # Rollbook entities (profiles, semesters, etc.)
│   ├── 0003_subject_description.sql # Adds description column to subjects
│   └── auth/                      # Upstream auth definitions
├── public/                         # Static assets, PWA icons, manifest
├── scripts/                        # Database migration, preview & test runners
│   ├── migrate.mjs                # Production migration executor
│   ├── migration-plan.mjs         # Migration diffing & sequencing
│   └── with-app-env.mjs           # Environment loader wrapper
├── src/
│   ├── components/                # Modular UI components
│   │   ├── ui/                    # Base primitives (Button, Card, Dialog, Input)
│   │   ├── app-shell.tsx          # Navigation header, sidebar, user controls
│   │   ├── credit-form.tsx        # Dialog to grant & save teacher credits
│   │   ├── mark-pad.tsx           # Quick-marking pad for attendance
│   │   ├── percent-ring.tsx       # SVG circular progress ring for attendance %
│   │   └── stats-line.tsx         # Metric summary badges
│   ├── lib/
│   │   ├── auth/                  # Better Auth server, client, middleware & hooks
│   │   ├── db.ts                  # Dual-source SQL driver (PGLite vs Neon)
│   │   ├── env.server.ts          # Server environment validation
│   │   └── rollbook/              # Core business logic
│   │       ├── api.ts             # Server functions (RPC endpoints)
│   │       ├── derive.ts          # Snapshot subject & semester aggregations
│   │       ├── stats.ts           # Bunk, recovery, and percentage calculations
│   │       └── types.ts           # Domain models & TypeScript interfaces
│   ├── routes/                    # TanStack file-based router pages
│   │   ├── __root.tsx             # Root layout with QueryClient & Toasters
│   │   ├── index.tsx              # Main dashboard (Today's classes & quick mark)
│   │   ├── setup.tsx              # Onboarding wizard (Profile & first semester)
│   │   ├── subjects.tsx           # Subject list & aggregation
│   │   ├── subjects.$subjectId.tsx# Subject detailed breakdown
│   │   ├── timetable.tsx          # Weekly schedule editor
│   │   ├── calendar.tsx           # Monthly attendance log
│   │   ├── settings.tsx           # Profile settings, threshold, data import/export
│   │   └── api/auth/$.ts          # Better Auth HTTP handler catch-all
│   ├── router.tsx                 # Router instance creation
│   └── styles.css                 # Tailwind CSS 4 style tokens
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

### Core Tech Stack

| Domain | Technology |
|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) with [TanStack Router](https://tanstack.com/router) |
| **View Engine** | [React 19](https://react.dev/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Authentication** | [Better Auth](https://better-auth.com/) (Email/Password, OAuth session tokens) |
| **Database** | Embedded [@electric-sql/pglite](https://pglite.dev/) (Dev/WASM) & [Neon PostgreSQL](https://neon.tech/) (Prod) |
| **Data Fetching** | [TanStack React Query](https://tanstack.com/query) with Server Functions |
| **Date Utilities** | [date-fns](https://date-fns.org/) |
| **Validation** | [Zod](https://zod.dev/) |

---

## Database Schema & Migrations

### Dual-Mode Database Engine (PGLite & Neon)

Rollbook implements an isomorphic `getSql()` interface in `src/lib/db.ts`:
- **When `DATABASE_URL` is unset**: Instantiates `@electric-sql/pglite` in WebAssembly with in-memory persistence. Runs migrations automatically via `import.meta.glob('/migrations/*.sql')` inside the browser/sandbox.
- **When `DATABASE_URL` is set**: Connects to Neon Serverless PostgreSQL using `pg.Pool` with connection pooling and normalized parser types (`int8 -> number`, `date -> YYYY-MM-DD string`).

### Data Model & Entities

```sql
-- 1. Student Profiles
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  college_name TEXT NOT NULL,
  threshold_percent INTEGER NOT NULL DEFAULT 75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Semesters
CREATE TABLE semesters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  semester_name TEXT NOT NULL,
  start_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  classes_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Subjects
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  default_teacher TEXT,
  description TEXT,                      -- optional notes, room, syllabus, multiple teachers
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Timetable Periods
CREATE TABLE periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,          -- 0 (Sun) to 6 (Sat)
  period_number INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, semester_id, day_of_week, period_number)
);

-- 5. Daily Attendance Logs
CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,                  -- 'present' | 'absent' | 'holiday' | 'cancelled'
  UNIQUE (user_id, period_id, date)
);

-- 6. Teacher Credit Grants
CREATE TABLE credit_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,                    -- 'notes' | 'assignment' | 'project' | 'other'
  teacher_name TEXT NOT NULL DEFAULT '',
  granted_on DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Attendance & Bunk Algorithms

All calculations are encapsulated in pure functional TypeScript inside `src/lib/rollbook/stats.ts`.

### Mathematical Formulations

Given:
- $P$: Present classes count
- $A$: Absent classes count
- $C$: Granted teacher credits
- $H$: Hosted classes $= P + A$
- $r$: Minimum required ratio $= \frac{\text{threshold}}{100}$ (e.g. $0.75$)

#### 1. Attendance Percentages
$$\text{Raw \%} = \frac{P}{H} \times 100$$

$$\text{Effective \%} = \frac{P + C}{H} \times 100$$

#### 2. Credit Deficit / Credits Needed
$$\text{Required Minimum Presence} = \lceil r \times H \rceil$$

$$\text{Credit Needed} = \max(0, \lceil r \times H \rceil - P - C)$$

#### 3. Bunkable Classes ($B$)
When $\text{Credit Needed} = 0$, student is at or above threshold. The number of upcoming classes they can skip without dropping below $r$ is:
$$B = \max\left(0, \left\lfloor \frac{P + C}{r} - H \right\rfloor\right)$$

#### 4. Classes to Attend to Clear Deficit ($N_{\text{attend}}$)
When $\text{Credit Needed} > 0$, student is in attendance shortage. Assuming all consecutive upcoming classes are attended:
$$\frac{P + C + N_{\text{attend}}}{H + N_{\text{attend}}} \ge r \implies N_{\text{attend}} = \left\lceil \frac{r \times H - (P + C)}{1 - r} \right\rceil$$

---

## Authentication & Security

- **Better Auth Framework**: Managed in `src/lib/auth/`. Employs standard JWT/session cookies stored on the first-party origin.
- **Tenant Isolation**: Every database query in `src/lib/rollbook/api.ts` enforces `user_id = $userId` derived from the verified session context (`authMiddleware`).
- **Input Sanitization**: All incoming payload shapes are validated through **Zod** schemas before executing parameterized SQL queries.

---

## Getting Started & Development

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm** or **pnpm**

### Environment Variables
Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Optional | Connection string for Neon / PostgreSQL. If omitted, Rollbook runs on embedded in-memory PGLite. |
| `BETTER_AUTH_SECRET` | Required for Auth | Secret signing key for session tokens. |
| `BETTER_AUTH_URL` | Optional | Host URL (default: `http://localhost:8080`). |
| `VITE_AUTH_ENABLED` | Required for Auth | Set to `true` when `DATABASE_URL` is configured. |
| `RESEND_API_KEY` | Required for email | API key from [resend.com](https://resend.com) — enables password reset emails. |
| `RESEND_FROM_EMAIL` | Optional | Sender address shown on reset emails (must be a verified domain in Resend). |

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Run in local development mode (PGLite WASM database auto-bootstraps)
npm run dev

# 3. Access in browser
# http://localhost:8080
```

### Available Scripts

- `npm run dev`: Starts Vite dev server on port 8080 with environment loader.
- `npm run build`: Compiles client & server assets with Vite, runs database migrations.
- `npm run db:migrate`: Executes pending migrations in `migrations/` against configured database.
- `npm run test`: Executes unit tests for calculation algorithms, readiness schedules, and auth guards.
- `npm run typecheck`: Runs `tsc --noEmit` across TypeScript sources.
- `npm run lint`: Checks styling and code smells with ESLint.

---

## Deployment

Rollbook is designed for frictionless zero-config deployment on **Vercel** or any Node/Docker serverless platform:

1. **Deploy to Vercel**: Connect the repository to Vercel.
2. **Environment Variables**: Add `DATABASE_URL` pointing to your [Neon](https://neon.tech) PostgreSQL instance, set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VITE_AUTH_ENABLED=true`, and `RESEND_API_KEY` for password reset emails. See `.env.example` for the full list.
3. **Build Command**: The default build script (`npm run build`) automatically applies all SQL migrations before completing deployment.

### Author

Mritunjay Kumar Pandey

# Rollbook 📚

> Modern, privacy-focused college attendance tracking, bunk planning, and credit management application built on TanStack Start, React 19, Tailwind CSS, Better Auth, and dual-mode PostgreSQL (Embedded PGLite & Cloud Neon). Installable as a PWA for offline-ready access on any device.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [1. Dashboard & Quick Mark](#1-dashboard--quick-mark)
  - [2. Semesters & Routines](#2-semesters--routines)
  - [3. Intelligent Attendance & Bunk Intelligence](#3-intelligent-attendance--bunk-intelligence)
  - [4. Teacher Credit System](#4-teacher-credit-system)
  - [5. Visual Analytics & Calendar](#5-visual-analytics--calendar)
  - [6. Extracurricular Participation Tracking](#6-extracurricular-participation-tracking)
  - [7. Holiday & Exam Mode](#7-holiday--exam-mode)
  - [8. Data Portability & Settings](#8-data-portability--settings)
  - [9. Notifications & Smart Alerts](#9-notifications--smart-alerts)
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
- [PWA & Offline](#pwa--offline)
- [Getting Started & Development](#getting-started--development)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation & Running](#installation--running)
  - [Available Scripts](#available-scripts)
- [Deployment](#deployment)

---

## Overview

**Rollbook** is designed specifically for college and university students managing attendance percentage requirements (e.g., 75% or 80% threshold). Unlike generic tracker apps, Rollbook factors in real-world academic dynamics:

- **Term → Routine hierarchy** — Academic years are organized into **Semesters** (Terms) which contain one or more **Routines** (timetables). Switch between routines within the same semester without losing history; view term-wide aggregated attendance across all routines.
- **Timetable-driven sessions** with period numbers, time slots, day-of-week slots, and per-slot teacher allocations.
- **Multi-teacher support** — each period slot can have its own teacher override on top of the subject's default faculty.
- **Teacher credit allowances** (compensatory attendance for assignments, notes, lab work, or departmental projects).
- **Exact bunk calculations** ("How many classes can I safely miss without dropping below threshold?").
- **Recovery calculations** ("How many consecutive classes must I attend to recover my standing?").
- **Routine archiving** — when the college changes the timetable mid-semester, archive the old routine and start fresh while keeping all historical attendance data intact.
- **Offline-ready and zero-setup local storage** using **PGLite** (Postgres in WASM) when running locally or in development, with frictionless migration to **Neon Serverless PostgreSQL** in production.
- **Background Sync API Integration** — Seamlessly marks your attendance while disconnected and automatically syncs in the background when connectivity returns.
- **Native-Like App Feeling** — Clean PWA history management with an Android-style exit interceptor (press back twice to exit) instead of infinite back button loops.

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
  - **Safe / Unsafe Badges**: Instantly see if you are above or below your attendance threshold with visual indicator badges on each subject.
- **Offline Marking Queue**: Marks your attendance securely using IndexedDB when cellular connectivity is poor. A Service Worker background sync automatically uploads your pending queue as soon as you reconnect, even if you've closed the app.

### 2. Semesters & Routines
- **Two-level hierarchy**:
  - **Semester** (Term) — the academic period, e.g. "Odd Semester 2025-26". Carries a session label (e.g. "2025-26"), optional start/end dates, and an `is_active` flag.
  - **Routine** — the weekly timetable inside a semester. A semester can have multiple routines (e.g. before and after a mid-semester schedule change).
- **Semester management** (Settings → Semesters):
  - Create, rename, activate, or delete semesters.
  - Switching to a semester automatically activates its most recent routine.
  - Deleting a semester with routines asks for confirmation.
- **Routine management** within each semester:
  - Create, **rename**, switch, move to another semester, or delete routines.
  - Renaming a routine never changes its `is_active` state or `term_id`.
  - The last routine in a semester cannot be deleted.
- **Term-wide attendance reporting**: The PDF report and subject list aggregate attendance across all routines in the active semester, using `origin_subject_id` to group copies of the same subject across routines.
- **Dynamic Weekly Timetable**:
  - Configure recurring classes by weekday (Monday–Saturday).
  - Routine is intentionally Monday–Saturday only; Sunday is excluded.
  - Slot by period number, start time, end time.
  - Per-slot teacher override — different faculty for the same subject on different days is fully supported.
  - Conflict prevention and unique indexing over `(user_id, semester_id, day_of_week, period_number)`.
- **Manage periods from the subject page**: Add, edit, or delete individual period slots directly from the subject detail view.
- **Class Timetable Sharing**: Generate a unique invite link or QR code to share your entire class routine with classmates. They can import it with one tap to instantly set up their own Rollbook.
- **Active / Closed Semesters**: Archive past semesters while retaining all historical attendance data.

### 3. Intelligent Attendance & Bunk Intelligence
- **Threshold Enforcement**: Customizable threshold percentage (default: 75%).
- **Raw vs. Effective Attendance**:
  - **Raw %**: Represents actual physical presence $\frac{\text{Present}}{\text{Hosted}} \times 100$.
  - **Effective %**: Adjusts for academic credits $\frac{\text{Present} + \text{Credits}}{\text{Hosted}} \times 100$.
  - **Predictive Calculations**:
    - Automatically calculates whether a student is "In the Clear" or "At Risk".
    - Predicts new percentage for next mark (e.g., if you attend or miss next class).
  - **Margin Predictor**: An interactive simulator on every subject page where you can simulate skipping or attending upcoming classes to dynamically see how your "Safe" status changes in real time.

### 4. Teacher Credit System
- **Academic Grace Credits**: Teachers often grant compensatory attendance for extracurriculars, project completions, or assignment submissions.
- **Granular Credit Types**:
  - `notes` — Class notes transcription / sharing
  - `assignment` — Timely assignment submission bonus
  - `project` — Lab, hackathon, or capstone deliverables
  - `other` — Discretionary attendance grants (e.g. an occasional Sunday class, workshop, or fest with an academic component)
- **Audit Trail**: Every credit record tracks granting teacher, date granted, point value, and optional context note.

### 5. Visual Analytics & Calendar
- **Interactive Calendar View**: Month-by-month grid displaying daily attendance states.
- **Future Date View**: Selecting a future date on the calendar shows that day's scheduled classes from the weekly routine in read-only mode (no marking allowed) — useful for planning ahead.
- **Subject-Specific Deep Dives**: Click any subject card to open a full detail view showing:
  - Subject code, all assigned teachers (default + per-slot overrides), and optional description/notes.
  - **Class schedule** grouped by day — every period listed with its time range and teacher, with inline edit and delete.
  - Add new period slots directly from the subject page.
  - Cumulative attendance percentage with bunk / recovery metrics.
  - Full colour-coded attendance history (present / absent / not held).
  - List of assigned teacher credits.
- **Per-subject completion toggle**: Mark individual subjects as "no more classes" without closing the whole semester. Completed subjects are visually dimmed with a strikethrough.

### 6. Extracurricular Participation Tracking
- **Activity Log**: Keep a dated log of workshops, fests, games, and other events you took part in.
- **Credit Integration**: Optionally associate participation events with credit points to keep a holistic view of your academic and extracurricular standing.

### 7. Holiday & Exam Mode
- **Pause Tracking**: Automatically pause notifications and strict tracking during college breaks, festivals, or exam weeks.
- **Custom Ranges**: Define your own break periods with start and end dates directly from Settings. Daily reminders will silently skip delivering during these active periods.

### 8. Data Portability & Settings
- **Attendance Summary PDF Export**: Generate a clean, printable monthly or semester attendance report for official college submissions or parent meetings directly from the settings page.
- **JSON Snapshot Export**: Download complete user data (profile, semesters, timetable, marks, credits) in one portable JSON file. Avatar images are stored separately in the database and are not included in the export.
- **Snapshot Import / Restore**: Seamless migration across browsers or test devices without data loss.
- **Locked Profile View**: Profile details are safely locked in read-only mode to prevent accidental modifications. You must explicitly click the "Edit" button to change your details.
- **Profile & Threshold Configuration**: Adjust student ID, college name, session/year, and target attendance percentage on the fly.
- **Social Links**: Connect with the developer via GitHub, LinkedIn, Twitter, and personal website directly from the settings page.
- **Profile Picture**: Upload a photo (max 50 KB) from Settings → Profile. The image is stored in the database and served via `/api/avatar` with a 24-hour browser cache.
- **PWA Install Prompt**: When the browser supports it, a non-intrusive banner offers to add Rollbook to the home screen for standalone, offline-ready access.

### 9. Notifications & Smart Alerts
- **Welcome Email**: New users automatically receive a customized welcome email on registration via Resend.
- **Push Notifications (Web Push)**: Subscribe to daily class summaries at 7:00 AM IST and get alerts if your attendance drops below your threshold. Works natively on browsers and mobile devices when installed as a PWA. (Requires VAPID keys and Vercel Cron).
- **Smart Notification Actions**: Morning push notifications include quick-action buttons directly in the notification drawer:
  - **"Mark All Present"** and **"Sick Day"** allow you to instantly mark attendance for the whole day without opening the app!
  - Built securely using zero-click background sync and temporary JWTs.

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
├── migrations/                     # SQL migration files (applied in order)
│   ├── 0001_auth.sql              # Better Auth tables
│   ├── 0002_rollbook.sql          # Core entities (profiles, semesters, subjects, periods, attendance)
│   ├── 0003_subject_description.sql
│   ├── 0004_avatar.sql
│   ├── 0005_activities.sql
│   ├── 0007_holidays.sql
│   ├── 0008_shared_routines.sql
│   ├── 0010_account_deletion_and_archive.sql
│   ├── 0011_profile_timezone.sql
│   ├── 0012_terms_and_session.sql  # Terms table, term_id on semesters, origin_subject_id, session
│   ├── 0013_term_classes_over_and_backfill.sql # classes_over on terms, backfill term_id
│   └── auth/                      # Upstream auth definitions
├── public/                         # Static assets, PWA icons, manifest, sw.js
├── scripts/                        # Database migration, preview & test runners
│   ├── migrate.mjs                # Production migration executor
│   ├── migration-plan.mjs         # Migration diffing & sequencing
│   └── with-app-env.mjs           # Environment loader wrapper
├── src/
│   ├── components/                # Modular UI components
│   │   ├── ui/                    # Base primitives (Button, Card, Dialog, Input)
│   │   ├── app-shell.tsx          # Navigation header, sidebar, user controls
│   │   ├── back-button-handler.tsx# Android-style native PWA back interceptor
│   │   ├── credit-form.tsx        # Dialog to grant & save teacher credits
│   │   ├── install-prompt.tsx     # PWA "Add to Home Screen" banner
│   │   ├── mark-pad.tsx           # Quick-marking pad for attendance
│   │   ├── percent-ring.tsx       # SVG circular progress ring for attendance %
│   │   ├── profile-avatar.tsx     # Avatar component (photo or initial fallback)
│   │   ├── share-dialog.tsx       # QR code and invite link generator
│   │   └── stats-line.tsx         # Metric summary badges
│   ├── lib/
│   │   ├── auth/                  # Better Auth server, client, middleware & hooks
│   │   ├── db.ts                  # Dual-source SQL driver (PGLite vs Neon)
│   │   ├── env.server.ts          # Server environment validation
│   │   ├── idb.ts                 # IndexedDB wrapper for offline queue
│   │   └── rollbook/              # Core business logic
│   │       ├── api.ts             # Server functions (RPC endpoints)
│   │       ├── derive.ts          # Snapshot aggregations (per-subject & term-wide)
│   │       ├── queries.ts         # React Query hooks & mutation cache management
│   │       ├── stats.ts           # Bunk, recovery, and percentage calculations
│   │       ├── types.ts           # Domain models & TypeScript interfaces
│   │       ├── api-logic.test.ts  # Unit tests: Zod schema & field-mask logic
│   │       └── upsert-pglite.test.ts # Integration tests: upsert SQL vs PGLite
│   ├── routes/                    # TanStack file-based router pages
│   │   ├── __root.tsx             # Root layout with QueryClient & Toasters
│   │   ├── index.tsx              # Main dashboard (Today's classes & quick mark)
│   │   ├── setup.tsx              # Onboarding wizard (Profile & first semester)
│   │   ├── subjects.tsx           # Subject list & aggregation
│   │   ├── subjects.$subjectId.tsx# Subject detailed breakdown
│   │   ├── timetable.tsx          # Weekly schedule editor
│   │   ├── calendar.tsx           # Monthly attendance log (future dates: read-only view)
│   │   ├── report.tsx             # Printable PDF attendance summary (term-wide)
│   │   ├── invite.$inviteId.tsx   # Timetable sharing import landing page
│   │   ├── settings.tsx           # Profile, semesters, routines, data import/export
│   │   ├── api/auth/$.ts          # Better Auth HTTP handler catch-all
│   │   └── api/sync.ts            # Background sync endpoint for offline queue
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
- **When `DATABASE_URL` is unset**: Instantiates `@electric-sql/pglite` in WebAssembly with in-memory persistence. Runs migrations automatically via `import.meta.glob('/migrations/*.sql')`.
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
  avatar_data TEXT,                      -- base64 data-URL ≤ 50 KB
  session TEXT,                          -- e.g. "2025-26" (academic year label)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Terms (Semesters — the top-level academic period grouping)
CREATE TABLE terms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,                    -- e.g. "Odd Semester 2025-26"
  session TEXT,                          -- e.g. "2025-26"
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  classes_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Routines (Semesters — the weekly timetable, nested inside a Term)
CREATE TABLE semesters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  term_id TEXT REFERENCES terms(id) ON DELETE SET NULL,  -- parent semester/term
  course_name TEXT NOT NULL,
  semester_name TEXT NOT NULL,           -- the routine's display name
  start_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  classes_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Subjects
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  default_teacher TEXT,
  description TEXT,
  origin_subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL, -- links copies across routines
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Timetable Periods
CREATE TABLE periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,          -- 1 (Mon) to 6 (Sat); 0 (Sun) excluded
  period_number INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, semester_id, day_of_week, period_number)
);

-- 6. Daily Attendance Logs
CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_id TEXT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,                  -- 'present' | 'absent' | 'holiday' | 'cancelled'
  UNIQUE (user_id, period_id, date)
);

-- 7. Teacher Credit Grants
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

-- 8. Activities (Extracurricular Participation)
CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  activity_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credits INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Holidays (Exam / Vacation Mode)
CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Shared Routines (Timetable Invites)
CREATE TABLE shared_routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payload TEXT NOT NULL,
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
- **Password Reset**: Fully wired via Better Auth's built-in forget/reset flow. A time-limited token is emailed via [Resend](https://resend.com); the `/forgot-password` and `/reset-password` routes handle the UI.

## PWA & Offline

Rollbook ships as a **Progressive Web App**:
- A `beforeinstallprompt` banner (`InstallPrompt`) appears automatically in supported browsers, offering one-tap installation to the home screen.
- Once installed it runs in standalone mode (no browser chrome) with the prompt suppressed.
- Avatar images are cached by the browser for 24 hours via `Cache-Control: public, max-age=86400, immutable` on `GET /api/avatar`.

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
| `DATABASE_URL` | Optional | Connection string for Neon / PostgreSQL. Use Neon's pooled endpoint (`-pooler` hostname) to avoid connection exhaustion on serverless. If omitted, Rollbook runs on embedded in-memory PGLite. |
| `BETTER_AUTH_SECRET` | Required for Auth | Secret signing key for session tokens. |
| `BETTER_AUTH_URL` | Optional | Host URL (default: `http://localhost:8080`). |
| `VITE_AUTH_ENABLED` | Required for Auth | Set to `true` when `DATABASE_URL` is configured. |
| `RESEND_API_KEY` | Required for email | API key from [resend.com](https://resend.com) — enables password reset & welcome emails. |
| `RESEND_FROM_EMAIL` | Optional | Sender address shown on emails (must be a verified domain in Resend). |
| `VAPID_PUBLIC_KEY` | Optional | Required for Web Push Notifications (Daily Summaries). |
| `VAPID_PRIVATE_KEY` | Optional | Required for Web Push Notifications. |

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
- `npm run test`: Runs unit tests (Zod schemas, bunk algorithms, auth guards) and PGLite integration tests for the upsert functions.
- `npm run typecheck`: Runs `tsc --noEmit` across TypeScript sources.
- `npm run lint`: Checks styling and code smells with ESLint.

---

## Deployment

Rollbook is designed for frictionless zero-config deployment on **Vercel** or any Node/Docker serverless platform:

1. **Deploy to Vercel**: Connect the repository to Vercel.
2. **Environment Variables**: Add `DATABASE_URL` pointing to your [Neon](https://neon.tech) PostgreSQL instance (always use the pooled connection string containing `-pooler` in the hostname to avoid connection exhaustion on serverless), set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `VITE_AUTH_ENABLED=true`, and `RESEND_API_KEY` for password reset emails. See `.env.example` for the full list.
3. **Build Command**: The default build script (`npm run build`) automatically applies all SQL migrations before completing deployment.

---

### Author

**Mritunjay Kumar Pandey**
🌐 [mritunjaylive.in](https://mritunjaylive.in)

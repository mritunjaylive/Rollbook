-- Introduce a "term" layer above routines (semesters) and add session/year
-- field to profiles. All additions are backwards-compatible (nullable columns,
-- default values) so existing rows are unaffected.

-- 1. Terms table — one per academic year / overall semester grouping.
--    A term contains one or more routines (semesters table rows).
create table if not exists terms (
  id text primary key,
  user_id text not null,
  name text not null,             -- e.g. "Even Semester 2025-26"
  session text,                   -- e.g. "2025-26" (optional, free text)
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists terms_user_id_idx on terms (user_id);

-- 2. Link each routine (semesters row) to its parent term.
--    Nullable so existing rows without a term still work.
alter table semesters add column if not exists term_id text references terms(id) on delete set null;

-- 3. Track which earlier-routine subject a subject was carried over from.
--    Used to group attendance across routines for term-wide reporting.
alter table subjects add column if not exists origin_subject_id text references subjects(id) on delete set null;

-- 4. Session field on profiles (e.g. "2025-26") — user-editable, optional.
alter table profiles add column if not exists session text;

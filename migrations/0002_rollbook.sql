-- Rollbook: per-user college attendance
create table if not exists profiles (
  user_id text primary key,
  student_name text not null,
  student_id text not null,
  college_name text not null,
  threshold_percent integer not null default 75,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists semesters (
  id text primary key,
  user_id text not null,
  course_name text not null,
  semester_name text not null,
  start_date date,
  is_active boolean not null default true,
  classes_over boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists semesters_user_id_idx on semesters (user_id);

create table if not exists subjects (
  id text primary key,
  user_id text not null,
  semester_id text not null references semesters(id) on delete cascade,
  name text not null,
  code text,
  default_teacher text,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists subjects_user_semester_idx on subjects (user_id, semester_id);

create table if not exists periods (
  id text primary key,
  user_id text not null,
  semester_id text not null references semesters(id) on delete cascade,
  subject_id text not null references subjects(id) on delete cascade,
  day_of_week integer not null,
  period_number integer not null,
  start_time text not null,
  end_time text not null,
  teacher_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists periods_user_semester_idx on periods (user_id, semester_id);
create unique index if not exists periods_slot_idx
  on periods (user_id, semester_id, day_of_week, period_number);

create table if not exists attendance (
  id text primary key,
  user_id text not null,
  period_id text not null references periods(id) on delete cascade,
  date date not null,
  status text not null,
  unique (user_id, period_id, date)
);
create index if not exists attendance_user_date_idx on attendance (user_id, date);
create index if not exists attendance_user_period_idx on attendance (user_id, period_id);

create table if not exists credit_grants (
  id text primary key,
  user_id text not null,
  subject_id text not null references subjects(id) on delete cascade,
  amount integer not null,
  type text not null,
  teacher_name text not null default '',
  granted_on date not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists credit_grants_user_subject_idx on credit_grants (user_id, subject_id);

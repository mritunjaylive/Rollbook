-- Extra-curricular participation (workshops, fests, games, etc.)
create table if not exists activities (
  id text primary key,
  user_id text not null,
  kind text not null,
  name text not null,
  activity_date date not null,
  start_time text not null,
  end_time text not null,
  description text not null default '',
  credits integer,
  created_at timestamptz not null default now()
);
create index if not exists activities_user_date_idx on activities (user_id, activity_date desc);

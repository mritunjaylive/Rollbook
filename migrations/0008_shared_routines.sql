create table if not exists shared_routines (
  id text primary key,
  user_id text not null,
  payload text not null,
  created_at timestamptz not null default now()
);

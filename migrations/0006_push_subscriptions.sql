create table if not exists push_subscriptions (
  id text primary key,
  user_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);
create unique index if not exists push_subscriptions_endpoint_idx on push_subscriptions (endpoint);

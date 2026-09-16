-- Add avatar storage to profiles.
-- Stored as a base64 data-URL (≤ 50 KB enforced at the application layer).
-- A separate column keeps the profiles row small for all other queries
-- because avatar_data is never selected in getSnapshot.
alter table profiles add column if not exists avatar_data text;

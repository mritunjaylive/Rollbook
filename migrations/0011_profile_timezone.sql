-- Adds timezone column to profiles.
-- Nullable so existing rows are unaffected; defaults to UTC behaviour when null.
alter table profiles add column if not exists timezone text;

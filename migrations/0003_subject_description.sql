-- Add optional description field to subjects for notes like syllabus, room, etc.
alter table subjects add column if not exists description text;

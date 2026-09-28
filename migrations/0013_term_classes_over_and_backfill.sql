-- Migration 0013: Add terms.classes_over and backfill terms and origin_subject_id

-- 1. Add classes_over column to terms
alter table terms add column if not exists classes_over boolean not null default false;

-- 2. Backfill terms for unattached routines:
-- Step 2a: Users who already have terms: attach unattached routines to their active term.
with active_user_terms as (
  select distinct on (user_id) user_id, id as term_id
  from terms
  order by user_id, is_active desc, created_at desc
)
update semesters s
set term_id = aut.term_id
from active_user_terms aut
where s.user_id = aut.user_id
  and s.term_id is null;

-- Step 2b: Users with routines where term_id is null: create ONE term per user.
-- Name = newest routine's semester_name
-- is_active = true if any of their routines is active
-- classes_over = true only if all of their routines had classes_over = true
with user_routines_summary as (
  select
    user_id,
    bool_or(is_active) as is_active,
    bool_and(classes_over) as classes_over
  from semesters
  where term_id is null
  group by user_id
),
newest_routine as (
  select distinct on (user_id)
    user_id,
    semester_name
  from semesters
  where term_id is null
  order by user_id, created_at desc
),
terms_to_insert as (
  select
    concat('term_', substr(md5(urs.user_id || '_legacy_term'), 1, 24)) as id,
    urs.user_id,
    nr.semester_name as name,
    urs.is_active,
    urs.classes_over,
    now() as created_at
  from user_routines_summary urs
  join newest_routine nr on urs.user_id = nr.user_id
),
inserted_terms as (
  insert into terms (id, user_id, name, is_active, classes_over, created_at)
  select id, user_id, name, is_active, classes_over, created_at
  from terms_to_insert
  on conflict (id) do update set
    classes_over = excluded.classes_over
  returning id, user_id
)
update semesters s
set term_id = it.id
from (
  select id, user_id from inserted_terms
  union
  select id, user_id from terms_to_insert
) it
where s.user_id = it.user_id
  and s.term_id is null;

-- 3. Backfill subjects.origin_subject_id for copies made before this change:
-- Inside each term, group subjects by normalized name (trim, lowercase, collapse spaces)
-- and point every non-earliest subject's origin at the earliest one's id.
with ranked_subjects as (
  select
    sub.id,
    sub.created_at,
    first_value(sub.id) over (
      partition by coalesce(sem.term_id, concat('unlinked_', sem.user_id)),
                   trim(regexp_replace(lower(sub.name), '\s+', ' ', 'g'))
      order by sub.created_at asc, sub.id asc
    ) as earliest_id
  from subjects sub
  join semesters sem on sub.semester_id = sem.id
)
update subjects s
set origin_subject_id = r.earliest_id
from ranked_subjects r
where s.id = r.id
  and s.id != r.earliest_id
  and (s.origin_subject_id is null or s.origin_subject_id != r.earliest_id);

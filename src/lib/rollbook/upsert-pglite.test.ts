/**
 * Integration tests for upsertSemester and upsertTerm SQL logic.
 *
 * Spins up an in-memory PGLite instance, applies the necessary schema,
 * and exercises the exact UPDATE SQL used by those server functions to
 * prove the CASE WHEN / COALESCE approach works correctly:
 *   - renaming a routine keeps it active, keeps its term_id, doesn't touch siblings
 *   - renaming with makeActive:true makes it the only active routine
 *   - renaming a term leaves its is_active unchanged
 *
 * Run: node --experimental-strip-types --test src/lib/rollbook/upsert-pglite.test.ts
 */
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// ── PGLite setup ──────────────────────────────────────────────────────────────

let pg: PGlite;

async function run<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pg.query<T>(text, params);
  return res.rows;
}

// Tagged-template helper mirroring db.ts's toSql.
function sql<T extends Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return run<T>(text, values);
}

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
  create table if not exists terms (
    id text primary key,
    user_id text not null,
    name text not null,
    start_date date,
    end_date date,
    is_active boolean not null default true,
    classes_over boolean not null default false,
    created_at timestamptz not null default now()
  );
  create table if not exists semesters (
    id text primary key,
    user_id text not null,
    term_id text references terms(id) on delete set null,
    course_name text not null,
    semester_name text not null,
    start_date date,
    is_active boolean not null default true,
    classes_over boolean not null default false,
    created_at timestamptz not null default now()
  );
`;

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(SCHEMA);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const UID = "user-test";

async function insertTerm(id: string, name: string, isActive: boolean) {
  await sql`insert into terms (id, user_id, name, is_active) values (${id}, ${UID}, ${name}, ${isActive})`;
}

async function insertSemester(id: string, termId: string | null, name: string, isActive: boolean) {
  await sql`
    insert into semesters (id, user_id, term_id, course_name, semester_name, is_active)
    values (${id}, ${UID}, ${termId}, ${"CS Degree"}, ${name}, ${isActive})
  `;
}

async function getSemester(id: string) {
  const rows = await sql<{ semester_name: string; term_id: string | null; is_active: boolean; course_name: string }>`
    select semester_name, term_id, is_active, course_name from semesters where id = ${id}
  `;
  return rows[0];
}

async function getTerm(id: string) {
  const rows = await sql<{ name: string; is_active: boolean }>`
    select name, is_active from terms where id = ${id}
  `;
  return rows[0];
}

// The exact SQL from upsertSemester's edit branch (reproduced verbatim).
async function callUpsertSemesterEdit(opts: {
  id: string;
  semesterName: string;
  courseName?: string;
  termId?: string | null;
  startDate?: string | null;
  makeActive?: boolean;
}) {
  const hasCourse  = opts.courseName !== undefined;
  const hasTermId  = opts.termId    !== undefined;
  const hasStart   = opts.startDate !== undefined;
  const start      = opts.startDate || null;
  const termId     = opts.termId   ?? null;
  const courseName = opts.courseName ?? null;

  if (opts.makeActive === true) {
    await sql`update semesters set is_active = false where user_id = ${UID}`;
  }

  await sql`
    update semesters
    set
      semester_name = ${opts.semesterName},
      course_name   = case when ${hasCourse}::boolean
                           then ${courseName}::text
                           else course_name
                      end,
      start_date    = case when ${hasStart}::boolean
                           then ${start}::date
                           else start_date
                      end,
      term_id       = case when ${hasTermId}::boolean
                           then ${termId}::text
                           else term_id
                      end,
      is_active     = case when ${opts.makeActive === true}::boolean
                           then true
                           else is_active
                      end
    where id = ${opts.id} and user_id = ${UID}
  `;
}

// The exact SQL from upsertTerm's edit branch.
async function callUpsertTermEdit(opts: {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  makeActive?: boolean;
}) {
  const start = opts.startDate || null;
  const end   = opts.endDate   || null;

  if (opts.makeActive === true) {
    await sql`update terms set is_active = false where user_id = ${UID}`;
  }

  await sql`
    update terms
    set name       = ${opts.name},
        start_date = ${start},
        end_date   = ${end},
        is_active  = case when ${opts.makeActive === true}::boolean
                          then true
                          else is_active
                     end
    where id = ${opts.id} and user_id = ${UID}
  `;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("upsertSemester edit branch (PGLite)", () => {
  it("rename-only: inactive routine stays inactive, keeps term_id, sibling stays active", async () => {
    await insertTerm("term-A", "Odd Sem 2025", true);
    await insertSemester("sem-A1", "term-A", "Routine 1", true);   // active
    await insertSemester("sem-A2", "term-A", "Routine 2", false);  // inactive

    await callUpsertSemesterEdit({ id: "sem-A2", semesterName: "Routine 2 Renamed" });

    const r2 = await getSemester("sem-A2");
    assert.equal(r2.semester_name, "Routine 2 Renamed", "name updated");
    assert.equal(r2.is_active, false, "is_active unchanged (still inactive)");
    assert.equal(r2.term_id, "term-A", "term_id unchanged");
    assert.equal(r2.course_name, "CS Degree", "course_name unchanged");

    const r1 = await getSemester("sem-A1");
    assert.equal(r1.is_active, true, "sibling remains active");
  });

  it("rename of active routine keeps it active", async () => {
    await insertTerm("term-B", "Even Sem 2026", true);
    await insertSemester("sem-B1", "term-B", "Routine 1", true);
    await insertSemester("sem-B2", "term-B", "Routine 2", false);

    await callUpsertSemesterEdit({ id: "sem-B1", semesterName: "Routine 1 Renamed" });

    const r1 = await getSemester("sem-B1");
    assert.equal(r1.semester_name, "Routine 1 Renamed");
    assert.equal(r1.is_active, true, "was active, stays active");

    const r2 = await getSemester("sem-B2");
    assert.equal(r2.is_active, false, "sibling unchanged");
  });

  it("makeActive===true: renamed routine becomes the only active one", async () => {
    await insertTerm("term-C", "Winter 2026", true);
    await insertSemester("sem-C1", "term-C", "Routine 1", true);   // currently active
    await insertSemester("sem-C2", "term-C", "Routine 2", false);  // will be activated

    await callUpsertSemesterEdit({ id: "sem-C2", semesterName: "Routine 2 Active", makeActive: true });

    const r2 = await getSemester("sem-C2");
    assert.equal(r2.is_active, true, "now active");
    assert.equal(r2.semester_name, "Routine 2 Active");

    const r1 = await getSemester("sem-C1");
    assert.equal(r1.is_active, false, "old active routine deactivated");
  });

  it("undefined termId leaves term_id unchanged; null termId detaches", async () => {
    await insertTerm("term-D", "Spring 2026", true);
    await insertSemester("sem-D1", "term-D", "Routine 1", true);

    // rename with no termId provided — should stay attached
    await callUpsertSemesterEdit({ id: "sem-D1", semesterName: "R1 Renamed" });
    assert.equal((await getSemester("sem-D1")).term_id, "term-D", "term_id unchanged");

    // now explicitly detach (null termId)
    await callUpsertSemesterEdit({ id: "sem-D1", semesterName: "R1 Detached", termId: null });
    assert.equal((await getSemester("sem-D1")).term_id, null, "term_id detached");
  });
});

describe("upsertTerm edit branch (PGLite)", () => {
  it("rename-only: is_active unchanged for active term", async () => {
    await insertTerm("term-E", "Active Term", true);
    await callUpsertTermEdit({ id: "term-E", name: "Active Term Renamed" });
    const t = await getTerm("term-E");
    assert.equal(t.name, "Active Term Renamed");
    assert.equal(t.is_active, true, "still active");
  });

  it("rename-only: is_active unchanged for inactive term", async () => {
    await insertTerm("term-F", "Inactive Term", false);
    await callUpsertTermEdit({ id: "term-F", name: "Inactive Renamed" });
    const t = await getTerm("term-F");
    assert.equal(t.name, "Inactive Renamed");
    assert.equal(t.is_active, false, "still inactive");
  });

  it("makeActive===true: activates the term", async () => {
    await insertTerm("term-G1", "Old Active", true);
    await insertTerm("term-G2", "To Activate", false);

    await callUpsertTermEdit({ id: "term-G2", name: "Now Active", makeActive: true });

    assert.equal((await getTerm("term-G2")).is_active, true, "term-G2 now active");
    assert.equal((await getTerm("term-G1")).is_active, false, "term-G1 deactivated");
  });
});

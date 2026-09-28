import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";
import type {
  Activity,
  ActivityKind,
  AttendanceEntry,
  AttendanceStatus,
  CreditGrant,
  CreditType,
  Period,
  Profile,
  Semester,
  Snapshot,
  Subject,
  Term,
} from "./types";

const statusSchema = z.enum(["present", "absent", "holiday", "cancelled"]);
const creditTypeSchema = z.enum(["notes", "assignment", "project", "other"]);
const activityKindSchema = z.enum(["workshop", "activity", "fest", "game", "other"]);

type ProfileRow = {
  student_name: string;
  student_id: string;
  college_name: string;
  threshold_percent: number;
  timezone: string | null;
  session: string | null;
  has_avatar: boolean;
  deletion_requested_at: string | null;
  scheduled_deletion_date: string | null;
};
type TermRow = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  classes_over: boolean;
};
type SemesterRow = {
  id: string;
  term_id: string | null;
  course_name: string;
  semester_name: string;
  start_date: string | null;
  is_active: boolean;
  classes_over: boolean;
};
type SubjectRow = {
  id: string;
  semester_id: string;
  name: string;
  code: string | null;
  default_teacher: string | null;
  description: string | null;
  closed: boolean;
  origin_subject_id: string | null;
};
type PeriodRow = {
  id: string;
  semester_id: string;
  subject_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  teacher_name: string;
};
type AttendanceRow = {
  id: string;
  period_id: string;
  date: string;
  status: AttendanceStatus;
};
type CreditRow = {
  id: string;
  subject_id: string;
  amount: number;
  type: CreditType;
  teacher_name: string;
  granted_on: string;
  note: string | null;
};
type ActivityRow = {
  id: string;
  kind: ActivityKind;
  name: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  description: string;
  credits: number | null;
};
type HolidayRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

function mapProfile(r: ProfileRow): Profile {
  return {
    studentName: r.student_name,
    studentId: r.student_id,
    collegeName: r.college_name,
    thresholdPercent: Number(r.threshold_percent),
    timezone: r.timezone ?? null,
    session: r.session ?? null,
    hasAvatar: Boolean(r.has_avatar),
    deletionRequestedAt: r.deletion_requested_at,
    scheduledDeletionDate: r.scheduled_deletion_date,
  };
}
function mapTerm(r: TermRow): Term {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: Boolean(r.is_active),
    classesOver: Boolean(r.classes_over),
  };
}
function mapSemester(r: SemesterRow): Semester {
  return {
    id: r.id,
    termId: r.term_id ?? null,
    courseName: r.course_name,
    semesterName: r.semester_name,
    startDate: r.start_date,
    isActive: Boolean(r.is_active),
    classesOver: Boolean(r.classes_over),
  };
}
function mapSubject(r: SubjectRow): Subject {
  return {
    id: r.id,
    semesterId: r.semester_id,
    name: r.name,
    code: r.code,
    defaultTeacher: r.default_teacher,
    description: r.description,
    closed: Boolean(r.closed),
    originSubjectId: r.origin_subject_id ?? null,
  };
}
function mapPeriod(r: PeriodRow): Period {
  return {
    id: r.id,
    semesterId: r.semester_id,
    subjectId: r.subject_id,
    dayOfWeek: Number(r.day_of_week),
    periodNumber: Number(r.period_number),
    startTime: r.start_time,
    endTime: r.end_time,
    teacherName: r.teacher_name,
  };
}
function mapAttendance(r: AttendanceRow): AttendanceEntry {
  return {
    id: r.id,
    periodId: r.period_id,
    date: r.date,
    status: r.status,
  };
}
function mapCredit(r: CreditRow): CreditGrant {
  return {
    id: r.id,
    subjectId: r.subject_id,
    amount: Number(r.amount),
    type: r.type,
    teacherName: r.teacher_name,
    grantedOn: r.granted_on,
    note: r.note,
  };
}
function mapActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    activityDate: r.activity_date,
    startTime: r.start_time,
    endTime: r.end_time,
    description: r.description,
    credits: r.credits == null ? null : Number(r.credits),
  };
}
function mapHoliday(r: HolidayRow) {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
  };
}

function isUniqueViolation(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|constraint/i.test(msg);
}

export const getSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Snapshot> => {
    const sql = await getSql();
    const uid = context.userId;

    const [terms, semesters] = await Promise.all([
      sql<TermRow>`select id, name, start_date, end_date, is_active, classes_over from terms where user_id = ${uid} order by created_at desc`,
      sql<SemesterRow>`select id, term_id, course_name, semester_name, start_date, is_active, classes_over from semesters where user_id = ${uid} order by created_at desc`,
    ]);
    const activeSem = semesters.find((s) => s.is_active) ?? semesters[0];
    const activeTerm =
      terms.find((t) => t.is_active) ??
      (activeSem?.term_id ? terms.find((t) => t.id === activeSem.term_id) : null) ??
      terms[0] ??
      null;

    // If active routine has a term_id, use that term.
    // If active routine has NO term_id (or no terms), targetTermId is null (implicit term).
    const targetTermId = activeSem ? activeSem.term_id : (activeTerm ? activeTerm.id : null);
    const hasRoutines = semesters.length > 0;

    const [profiles, subjects, periods, attendance, credits, activities, holidays] =
      await Promise.all([
        sql<ProfileRow>`select student_name, student_id, college_name, threshold_percent, timezone, session, (avatar_data is not null) as has_avatar, deletion_requested_at, scheduled_deletion_date from profiles where user_id = ${uid}`,
        hasRoutines
          ? targetTermId
            ? sql<SubjectRow>`select s.id, s.semester_id, s.name, s.code, s.default_teacher, s.description, s.closed, s.origin_subject_id from subjects s join semesters sem on s.semester_id = sem.id where s.user_id = ${uid} and sem.term_id = ${targetTermId} order by s.created_at`
            : sql<SubjectRow>`select s.id, s.semester_id, s.name, s.code, s.default_teacher, s.description, s.closed, s.origin_subject_id from subjects s join semesters sem on s.semester_id = sem.id where s.user_id = ${uid} and sem.term_id is null order by s.created_at`
          : Promise.resolve([]),
        hasRoutines
          ? targetTermId
            ? sql<PeriodRow>`select p.id, p.semester_id, p.subject_id, p.day_of_week, p.period_number, p.start_time, p.end_time, p.teacher_name from periods p join semesters sem on p.semester_id = sem.id where p.user_id = ${uid} and sem.term_id = ${targetTermId} order by p.day_of_week, p.period_number`
            : sql<PeriodRow>`select p.id, p.semester_id, p.subject_id, p.day_of_week, p.period_number, p.start_time, p.end_time, p.teacher_name from periods p join semesters sem on p.semester_id = sem.id where p.user_id = ${uid} and sem.term_id is null order by p.day_of_week, p.period_number`
          : Promise.resolve([]),
        hasRoutines
          ? targetTermId
            ? sql<AttendanceRow>`select a.id, a.period_id, a.date, a.status from attendance a join periods p on a.period_id = p.id join semesters sem on p.semester_id = sem.id where a.user_id = ${uid} and sem.term_id = ${targetTermId}`
            : sql<AttendanceRow>`select a.id, a.period_id, a.date, a.status from attendance a join periods p on a.period_id = p.id join semesters sem on p.semester_id = sem.id where a.user_id = ${uid} and sem.term_id is null`
          : Promise.resolve([]),
        hasRoutines
          ? targetTermId
            ? sql<CreditRow>`select c.id, c.subject_id, c.amount, c.type, c.teacher_name, c.granted_on, c.note from credit_grants c join subjects s on c.subject_id = s.id join semesters sem on s.semester_id = sem.id where c.user_id = ${uid} and sem.term_id = ${targetTermId} order by c.granted_on desc`
            : sql<CreditRow>`select c.id, c.subject_id, c.amount, c.type, c.teacher_name, c.granted_on, c.note from credit_grants c join subjects s on c.subject_id = s.id join semesters sem on s.semester_id = sem.id where c.user_id = ${uid} and sem.term_id is null order by c.granted_on desc`
          : Promise.resolve([]),
        sql<ActivityRow>`select id, kind, name, activity_date, start_time, end_time, description, credits from activities where user_id = ${uid} order by activity_date desc, start_time desc`,
        sql<HolidayRow>`select id, name, start_date, end_date from holidays where user_id = ${uid} order by start_date desc`,
      ]);
    return {
      profile: profiles[0] ? mapProfile(profiles[0]) : null,
      terms: terms.map(mapTerm),
      semesters: semesters.map(mapSemester),
      subjects: subjects.map(mapSubject),
      periods: periods.map(mapPeriod),
      attendance: attendance.map(mapAttendance),
      credits: credits.map(mapCredit),
      activities: activities.map(mapActivity),
      holidays: holidays.map(mapHoliday),
    };
  });

export const getFullBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Snapshot> => {
    const sql = await getSql();
    const uid = context.userId;
    const [profiles, terms, semesters, subjects, periods, attendance, credits, activities, holidays] =
      await Promise.all([
        sql<ProfileRow>`select student_name, student_id, college_name, threshold_percent, timezone, session, (avatar_data is not null) as has_avatar, deletion_requested_at, scheduled_deletion_date from profiles where user_id = ${uid}`,
        sql<TermRow>`select id, name, start_date, end_date, is_active, classes_over from terms where user_id = ${uid} order by created_at desc`,
        sql<SemesterRow>`select id, term_id, course_name, semester_name, start_date, is_active, classes_over from semesters where user_id = ${uid} order by created_at desc`,
        sql<SubjectRow>`select id, semester_id, name, code, default_teacher, description, closed, origin_subject_id from subjects where user_id = ${uid} order by created_at`,
        sql<PeriodRow>`select id, semester_id, subject_id, day_of_week, period_number, start_time, end_time, teacher_name from periods where user_id = ${uid} order by day_of_week, period_number`,
        sql<AttendanceRow>`select id, period_id, date, status from attendance where user_id = ${uid}`,
        sql<CreditRow>`select id, subject_id, amount, type, teacher_name, granted_on, note from credit_grants where user_id = ${uid} order by granted_on desc`,
        sql<ActivityRow>`select id, kind, name, activity_date, start_time, end_time, description, credits from activities where user_id = ${uid} order by activity_date desc, start_time desc`,
        sql<HolidayRow>`select id, name, start_date, end_date from holidays where user_id = ${uid} order by start_date desc`,
      ]);
    return {
      profile: profiles[0] ? mapProfile(profiles[0]) : null,
      terms: terms.map(mapTerm),
      semesters: semesters.map(mapSemester),
      subjects: subjects.map(mapSubject),
      periods: periods.map(mapPeriod),
      attendance: attendance.map(mapAttendance),
      credits: credits.map(mapCredit),
      activities: activities.map(mapActivity),
      holidays: holidays.map(mapHoliday),
    };
  });

export function isValidSession(val: string): boolean {
  const s = val.trim();
  if (!s) return true;
  const mFull = s.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (mFull) {
    const start = parseInt(mFull[1], 10);
    const end = parseInt(mFull[2], 10);
    return end > start;
  }
  const mShort = s.match(/^(\d{4})\s*[-–]\s*(\d{2})$/);
  if (mShort) {
    const start = parseInt(mShort[1], 10);
    const startCentury = Math.floor(start / 100) * 100;
    const end = startCentury + parseInt(mShort[2], 10);
    return end > start;
  }
  return false;
}

const profileInput = z.object({
  studentName: z.string().trim().min(1).max(120),
  studentId: z.string().trim().min(1).max(80),
  collegeName: z.string().trim().min(1).max(160),
  thresholdPercent: z.number().int().min(50).max(100).optional(),
  // Optional — client sends this silently; never required from user input.
  timezone: z.string().trim().max(60).optional().nullable(),
  // Academic session / year, e.g. "2025-2027" or "2025-26". Optional, user-editable.
  session: z
    .string()
    .trim()
    .max(40)
    .refine((val) => !val || isValidSession(val), {
      message: "Session must be in format YYYY-YYYY or YYYY-YY (e.g. 2025-2027 or 2025-26).",
    })
    .optional()
    .nullable(),
});

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => profileInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const threshold = data.thresholdPercent ?? 75;
    // Only update timezone when explicitly provided (avoid clearing a stored value
    // when the user edits other profile fields from a client that didn't send it).
    const tz = data.timezone ?? null;
    const sess = data.session !== undefined ? (data.session || null) : undefined;
    if (tz !== null) {
      if (sess !== undefined) {
        await sql`
          insert into profiles (user_id, student_name, student_id, college_name, threshold_percent, timezone, session, updated_at)
          values (${uid}, ${data.studentName}, ${data.studentId}, ${data.collegeName}, ${threshold}, ${tz}, ${sess}, now())
          on conflict (user_id) do update set
            student_name = excluded.student_name,
            student_id = excluded.student_id,
            college_name = excluded.college_name,
            threshold_percent = excluded.threshold_percent,
            timezone = excluded.timezone,
            session = excluded.session,
            updated_at = now()
        `;
      } else {
        await sql`
          insert into profiles (user_id, student_name, student_id, college_name, threshold_percent, timezone, updated_at)
          values (${uid}, ${data.studentName}, ${data.studentId}, ${data.collegeName}, ${threshold}, ${tz}, now())
          on conflict (user_id) do update set
            student_name = excluded.student_name,
            student_id = excluded.student_id,
            college_name = excluded.college_name,
            threshold_percent = excluded.threshold_percent,
            timezone = excluded.timezone,
            updated_at = now()
        `;
      }
    } else {
      if (sess !== undefined) {
        await sql`
          insert into profiles (user_id, student_name, student_id, college_name, threshold_percent, session, updated_at)
          values (${uid}, ${data.studentName}, ${data.studentId}, ${data.collegeName}, ${threshold}, ${sess}, now())
          on conflict (user_id) do update set
            student_name = excluded.student_name,
            student_id = excluded.student_id,
            college_name = excluded.college_name,
            threshold_percent = excluded.threshold_percent,
            session = excluded.session,
            updated_at = now()
        `;
      } else {
        await sql`
          insert into profiles (user_id, student_name, student_id, college_name, threshold_percent, updated_at)
          values (${uid}, ${data.studentName}, ${data.studentId}, ${data.collegeName}, ${threshold}, now())
          on conflict (user_id) do update set
            student_name = excluded.student_name,
            student_id = excluded.student_id,
            college_name = excluded.college_name,
            threshold_percent = excluded.threshold_percent,
            updated_at = now()
        `;
      }
    }
    return { ok: true as const };
  });

/** Silently backfill timezone on the profile row. Called client-side on first load. */
export const updateTimezone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ timezone: z.string().trim().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update profiles set timezone = ${data.timezone}
      where user_id = ${context.userId} and (timezone is null or timezone = '')
    `;
    return { ok: true as const };
  });

const termInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  makeActive: z.boolean().optional(),
});

export const upsertTerm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => termInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    const start = data.startDate || null;
    const end = data.endDate || null;
    if (data.id) {
      // Updating an existing term: only touch name/dates.
      // Only switch active term when makeActive is explicitly true.
      if (data.makeActive === true) {
        await sql`update terms set is_active = false where user_id = ${uid}`;
      }
      // Single UPDATE — is_active only flips to true when makeActive===true;
      // otherwise the CASE leaves the existing column value untouched.
      await sql`
        update terms
        set name       = ${data.name},
            start_date = ${start},
            end_date   = ${end},
            is_active  = case when ${data.makeActive === true}::boolean
                              then true
                              else is_active
                         end
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      // Creating a new term always activates it (deactivate all others first).
      await sql`update terms set is_active = false where user_id = ${uid}`;
      await sql`
        insert into terms (id, user_id, name, start_date, end_date, is_active)
        values (${id}, ${uid}, ${data.name}, ${start}, ${end}, true)
      `;
    }
    return { id };
  });

export const setTermClassesOver = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ id: z.string(), classesOver: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update terms set classes_over = ${data.classesOver}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const moveRoutineToTerm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ routineId: z.string(), termId: z.string().nullable() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update semesters set term_id = ${data.termId}
      where id = ${data.routineId} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const deleteSemester = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    // Fetch the routine to be deleted.
    const [target] = await sql<SemesterRow>`
      select id, term_id, course_name, semester_name, start_date, is_active, classes_over
      from semesters where id = ${data.id} and user_id = ${uid}
    `;
    if (!target) throw new Error("Routine not found.");

    // If it belongs to a term, check that it is not the last routine.
    if (target.term_id) {
      const siblings = await sql<{ id: string; is_active: boolean }>`
        select id, is_active from semesters
        where term_id = ${target.term_id} and user_id = ${uid}
        order by created_at desc
      `;
      if (siblings.length <= 1) {
        throw new Error(
          "Cannot delete the last routine in a semester. Delete the semester instead, or add another routine first.",
        );
      }
      // If the routine being deleted is active, activate the most-recent sibling.
      if (Boolean(target.is_active)) {
        const nextActive = siblings.find((s) => s.id !== data.id);
        if (nextActive) {
          await sql`update semesters set is_active = false where user_id = ${uid}`;
          await sql`update semesters set is_active = true where id = ${nextActive.id} and user_id = ${uid}`;
        }
      }
    }

    await sql`delete from semesters where id = ${data.id} and user_id = ${uid}`;
    return { ok: true as const };
  });

export const deleteTerm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ id: z.string(), deleteRoutines: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    if (data.deleteRoutines) {
      await sql`delete from semesters where term_id = ${data.id} and user_id = ${uid}`;
    } else {
      const remaining = await sql<{ id: string }>`select id from semesters where term_id = ${data.id} and user_id = ${uid} limit 1`;
      if (remaining.length > 0) {
        throw new Error("Cannot delete semester that contains routines without confirmation.");
      }
    }
    await sql`delete from terms where id = ${data.id} and user_id = ${uid}`;
    return { ok: true as const };
  });

export const setActiveTerm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    // Verify the term exists and has at least one routine.
    const routines = await sql<{ id: string }>`
      select id from semesters
      where term_id = ${data.id} and user_id = ${uid}
      order by created_at desc
    `;
    if (routines.length === 0) {
      throw new Error("This semester has no routines. Add a routine before switching to it.");
    }

    // Activate the term.
    await sql`update terms set is_active = false where user_id = ${uid}`;
    await sql`update terms set is_active = true where id = ${data.id} and user_id = ${uid}`;

    // Check if the currently-active routine already belongs to this term.
    const alreadyActiveInTerm = await sql<{ id: string }>`
      select id from semesters
      where term_id = ${data.id} and user_id = ${uid} and is_active = true
      limit 1
    `;
    if (alreadyActiveInTerm.length === 0) {
      // Activate the most recently created routine of this term.
      const mostRecent = routines[0];
      await sql`update semesters set is_active = false where user_id = ${uid}`;
      await sql`update semesters set is_active = true where id = ${mostRecent.id} and user_id = ${uid}`;
    }

    return { ok: true as const };
  });

// Two shapes: create requires courseName; edit only requires semesterName (and id).
// Everything else is optional in both shapes.
const semesterCreateInput = z.object({
  id: z.undefined().optional(),
  termId: z.string().optional().nullable(),
  courseName: z.string().trim().min(1).max(160),
  semesterName: z.string().trim().min(1).max(80),
  startDate: z.string().nullable().optional(),
  makeActive: z.boolean().optional(),
});
const semesterEditInput = z.object({
  id: z.string(),
  termId: z.string().optional().nullable(), // undefined = leave unchanged; null = detach
  courseName: z.string().trim().min(1).max(160).optional(),
  semesterName: z.string().trim().min(1).max(80),
  startDate: z.string().nullable().optional(), // undefined = leave unchanged
  makeActive: z.boolean().optional(),
});
const semesterInput = z.union([semesterEditInput, semesterCreateInput]);

export const upsertSemester = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => semesterInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();

    if (data.id) {
      // ── EDIT ────────────────────────────────────────────────────────────────
      // Deactivate all other routines only when makeActive is explicitly true.
      if (data.makeActive === true) {
        await sql`update semesters set is_active = false where user_id = ${uid}`;
      }

      // Flags: undefined means "leave column unchanged"; presence (even null) means update.
      const hasCourse  = data.courseName !== undefined;
      const hasTermId  = data.termId    !== undefined;
      const hasStart   = data.startDate !== undefined;
      const start      = data.startDate || null;
      const termId     = data.termId   ?? null;
      const courseName = data.courseName ?? null;

      // Single UPDATE — no nested sql`` fragments.
      // COALESCE(new_value, old_column) only works when we want null-to-keep.
      // For optional fields we use CASE WHEN flag::boolean THEN new ELSE old END.
      await sql`
        update semesters
        set
          semester_name = ${data.semesterName},
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
          is_active     = case when ${data.makeActive === true}::boolean
                               then true
                               else is_active
                          end
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      // ── CREATE: always activates the new routine ──
      const termId = data.termId ?? null;
      const start = data.startDate || null;
      await sql`update semesters set is_active = false where user_id = ${uid}`;
      await sql`
        insert into semesters (id, user_id, term_id, course_name, semester_name, start_date, is_active)
        values (${id}, ${uid}, ${termId}, ${data.courseName}, ${data.semesterName}, ${start}, true)
      `;
    }
    return { id };
  });

export const setActiveSemester = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    await sql`update semesters set is_active = false where user_id = ${uid}`;
    await sql`update semesters set is_active = true where id = ${data.id} and user_id = ${uid}`;
    return { ok: true as const };
  });

export const setSemesterClassesOver = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ id: z.string(), classesOver: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update semesters set classes_over = ${data.classesOver}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

const subjectInput = z.object({
  id: z.string().optional(),
  semesterId: z.string(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).optional().nullable(),
  defaultTeacher: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const upsertSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => subjectInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    const code = data.code || null;
    const teacher = data.defaultTeacher || null;
    const description = data.description || null;
    if (data.id) {
      await sql`
        update subjects
        set name = ${data.name}, code = ${code}, default_teacher = ${teacher}, description = ${description}
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description)
        values (${id}, ${uid}, ${data.semesterId}, ${data.name}, ${code}, ${teacher}, ${description})
      `;
    }
    return { id };
  });

export const setSubjectClosed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ id: z.string(), closed: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update subjects set closed = ${data.closed}
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from subjects where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

// Intentionally constrained to Monday–Saturday (1–6). Sunday (0 or 7) is
// deliberately excluded and must NOT be added here. For occasional/exceptional
// Sunday classes, use the Teacher Credit system (credit_grants / addCreditGrant).
import { periodInput } from "./days.ts";
export { periodInput };

export const upsertPeriod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => periodInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    const teacher = data.teacherName ?? "";
    try {
      if (data.id) {
        await sql`
          update periods
          set subject_id = ${data.subjectId},
              day_of_week = ${data.dayOfWeek},
              period_number = ${data.periodNumber},
              start_time = ${data.startTime},
              end_time = ${data.endTime},
              teacher_name = ${teacher}
          where id = ${id} and user_id = ${uid}
        `;
      } else {
        await sql`
          insert into periods (
            id, user_id, semester_id, subject_id, day_of_week,
            period_number, start_time, end_time, teacher_name
          ) values (
            ${id}, ${uid}, ${data.semesterId}, ${data.subjectId}, ${data.dayOfWeek},
            ${data.periodNumber}, ${data.startTime}, ${data.endTime}, ${teacher}
          )
        `;
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new Error("That period slot is already used on this day.");
      }
      throw err;
    }
    return { id };
  });

export const deletePeriod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from periods where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

const markInput = z.object({
  periodId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: statusSchema,
});

export const markAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => markInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const owned = await sql<{
      id: string;
      term_classes_over: boolean | null;
      sem_classes_over: boolean;
    }>`
      select p.id, t.classes_over as term_classes_over, s.classes_over as sem_classes_over
      from periods p
      join semesters s on p.semester_id = s.id
      left join terms t on s.term_id = t.id
      where p.id = ${data.periodId} and p.user_id = ${uid}
    `;
    if (!owned[0]) throw new Error("Period not found.");
    if (owned[0].term_classes_over ?? owned[0].sem_classes_over) {
      throw new Error("Classes are over for this semester.");
    }
    const id = newId();
    await sql`
      insert into attendance (id, user_id, period_id, date, status)
      values (${id}, ${uid}, ${data.periodId}, ${data.date}, ${data.status})
      on conflict (user_id, period_id, date) do update set status = excluded.status
    `;
    return { ok: true as const };
  });

export const markDayStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: statusSchema,
        periodIds: z.array(z.string()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    for (const periodId of data.periodIds) {
      const owned = await sql<{
        id: string;
        term_classes_over: boolean | null;
        sem_classes_over: boolean;
      }>`
        select p.id, t.classes_over as term_classes_over, s.classes_over as sem_classes_over
        from periods p
        join semesters s on p.semester_id = s.id
        left join terms t on s.term_id = t.id
        where p.id = ${periodId} and p.user_id = ${uid}
      `;
      if (!owned[0]) throw new Error("Period not found.");
      if (owned[0].term_classes_over ?? owned[0].sem_classes_over) {
        throw new Error("Classes are over for this semester.");
      }
      const id = newId();
      await sql`
        insert into attendance (id, user_id, period_id, date, status)
        values (${id}, ${uid}, ${periodId}, ${data.date}, ${data.status})
        on conflict (user_id, period_id, date) do update set status = excluded.status
      `;
    }
    return { ok: true as const };
  });

export const clearAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        periodId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from attendance
      where user_id = ${context.userId} and period_id = ${data.periodId} and date = ${data.date}
    `;
    return { ok: true as const };
  });

const creditInput = z.object({
  subjectId: z.string(),
  amount: z.number().int().min(1).max(40),
  type: creditTypeSchema,
  teacherName: z.string().trim().max(120).optional(),
  grantedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(240).optional().nullable(),
});

export const addCreditGrant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => creditInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const owned = await sql<{ id: string }>`
      select id from subjects where id = ${data.subjectId} and user_id = ${uid}
    `;
    if (!owned[0]) throw new Error("Subject not found.");
    const id = newId();
    const teacher = data.teacherName ?? "";
    const note = data.note || null;
    await sql`
      insert into credit_grants (id, user_id, subject_id, amount, type, teacher_name, granted_on, note)
      values (${id}, ${uid}, ${data.subjectId}, ${data.amount}, ${data.type}, ${teacher}, ${data.grantedOn}, ${note})
    `;
    return { id };
  });

const archiveRoutineInput = z.object({
  semesterId: z.string(),
  newSemesterName: z.string().trim().min(1).max(80),
  /**
   * If provided, the new routine is associated with this term.
   * Pass the same termId as the current routine to keep them in the same term,
   * or a different termId to start a new term's first routine.
   * Omit to leave the new routine unlinked (legacy behaviour).
   */
  termId: z.string().optional().nullable(),
});

/**
 * Archives the current semester's routine by:
 * 1. Marking the current routine inactive (does NOT set classes_over)
 * 2. Creating a new routine (same courseName, new semesterName) as active
 * 3. Copying all subjects across (no periods — blank slate for the new routine)
 *    — each new subject records originSubjectId pointing at its source, enabling
 *    term-wide attendance aggregation across routines.
 * Returns the new semester id and a map of old→new subject ids.
 */
export const archiveRoutine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => archiveRoutineInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    // Fetch current semester
    const [sem] = await sql<SemesterRow>`
      select id, term_id, course_name, semester_name, start_date, is_active, classes_over
      from semesters where id = ${data.semesterId} and user_id = ${uid}
    `;
    if (!sem) throw new Error("Semester not found.");

    // Fetch subjects for this semester
    const subjects = await sql<SubjectRow>`
      select id, semester_id, name, code, default_teacher, description, closed, origin_subject_id
      from subjects where semester_id = ${data.semesterId} and user_id = ${uid}
      order by created_at
    `;

    // Inactivate old routine (do NOT set classes_over)
    await sql`
      update semesters
      set is_active = false
      where id = ${data.semesterId} and user_id = ${uid}
    `;

    // Determine term for the new routine:
    // use explicitly supplied termId, or inherit from the archived semester.
    const newTermId = data.termId !== undefined ? (data.termId ?? null) : (sem.term_id ?? null);

    // Create new active semester
    const newSemId = newId();
    await sql`
      insert into semesters (id, user_id, term_id, course_name, semester_name, start_date, is_active)
      values (${newSemId}, ${uid}, ${newTermId}, ${sem.course_name}, ${data.newSemesterName}, now()::date, true)
    `;

    // Copy subjects (reset closed flag, no periods).
    // Set origin_subject_id to the canonical origin of each subject so that
    // term-wide aggregation can follow the chain across multiple archives.
    const idMap: Record<string, string> = {};
    for (const s of subjects) {
      const newSubId = newId();
      idMap[s.id] = newSubId;
      // origin_subject_id = the root of the lineage (if s itself was already a
      // copy, its origin_subject_id already points to the root; otherwise s.id is the root).
      const originId = s.origin_subject_id ?? s.id;
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description, origin_subject_id)
        values (${newSubId}, ${uid}, ${newSemId}, ${s.name}, ${s.code}, ${s.default_teacher}, ${s.description ?? null}, ${originId})
      `;
    }

    return { newSemesterId: newSemId, subjectIdMap: idMap };
  });

export const deleteCreditGrant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from credit_grants where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

const activityInput = z.object({
  id: z.string().optional(),
  kind: activityKindSchema,
  name: z.string().trim().min(1).max(160),
  activityDate: z.string().min(1),
  startTime: z.string().min(1).max(8),
  endTime: z.string().min(1).max(8),
  description: z.string().trim().max(2000),
  credits: z.number().int().min(0).max(999).nullable(),
});

export const upsertActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => activityInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    if (data.id) {
      await sql`
        update activities
        set kind = ${data.kind},
            name = ${data.name},
            activity_date = ${data.activityDate},
            start_time = ${data.startTime},
            end_time = ${data.endTime},
            description = ${data.description},
            credits = ${data.credits}
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      await sql`
        insert into activities (id, user_id, kind, name, activity_date, start_time, end_time, description, credits)
        values (${id}, ${uid}, ${data.kind}, ${data.name}, ${data.activityDate}, ${data.startTime}, ${data.endTime}, ${data.description}, ${data.credits})
      `;
    }
    return { id };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from activities where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

const holidayInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => holidayInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    if (data.id) {
      await sql`
        update holidays
        set name = ${data.name}, start_date = ${data.startDate}, end_date = ${data.endDate}
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      await sql`
        insert into holidays (id, user_id, name, start_date, end_date)
        values (${id}, ${uid}, ${data.name}, ${data.startDate}, ${data.endDate})
      `;
    }
    return { id };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from holidays where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

// ── Avatar ────────────────────────────────────────────────────────────────────
// avatar_data is stored in the profiles table (0004_avatar.sql) but NEVER
// fetched by getSnapshot — it is only read via GET /api/avatar, which sets
// a 24-hour Cache-Control header so the browser downloads it at most once
// per day and serves it from disk cache on every subsequent render.

/** Returns the raw base64 data-URL for the current user's avatar, or null. */
export const getAvatarData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ dataUrl: string | null; updatedAt: string | null }> => {
    const sql = await getSql();
    const rows = await sql<{ avatar_data: string | null; updated_at: string }>`
      select avatar_data, updated_at from profiles where user_id = ${context.userId}
    `;
    return {
      dataUrl: rows[0]?.avatar_data ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    };
  });

const MAX_AVATAR_BYTES = 50 * 1024; // 50 KB

/** Save (or replace) the avatar for the current user. */
export const upsertAvatarData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({
      dataUrl: z
        .string()
        .refine((s) => s.startsWith("data:image/"), "Must be an image data-URL.")
        .refine((s) => {
          const base64 = s.split(",")[1] ?? "";
          return Math.ceil((base64.length * 3) / 4) <= MAX_AVATAR_BYTES;
        }, "Image exceeds 50 KB limit."),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    // Upsert: profile row must already exist (created during setup).
    await sql`
      update profiles
      set avatar_data = ${data.dataUrl}, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

/** Remove the avatar for the current user. */
export const deleteAvatarData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      update profiles set avatar_data = null, updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

const importSchema = z.object({
  version: z.literal(1),
  profile: profileInput.nullable(),
  terms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        isActive: z.boolean(),
        classesOver: z.boolean().optional(),
      }),
    )
    .default([]),
  semesters: z.array(
    z.object({
      id: z.string(),
      termId: z.string().nullable().optional(),
      courseName: z.string(),
      semesterName: z.string(),
      startDate: z.string().nullable(),
      isActive: z.boolean(),
      classesOver: z.boolean(),
    }),
  ),
  subjects: z.array(
    z.object({
      id: z.string(),
      semesterId: z.string(),
      name: z.string(),
      code: z.string().nullable(),
      defaultTeacher: z.string().nullable(),
      description: z.string().nullable().optional(),
      closed: z.boolean(),
      originSubjectId: z.string().nullable().optional(),
    }),
  ),
  periods: z.array(
    z.object({
      id: z.string(),
      semesterId: z.string(),
      subjectId: z.string(),
      dayOfWeek: z.number(),
      periodNumber: z.number(),
      startTime: z.string(),
      endTime: z.string(),
      teacherName: z.string(),
    }),
  ),
  attendance: z.array(
    z.object({
      id: z.string(),
      periodId: z.string(),
      date: z.string(),
      status: statusSchema,
    }),
  ),
  credits: z.array(
    z.object({
      id: z.string(),
      subjectId: z.string(),
      amount: z.number(),
      type: creditTypeSchema,
      teacherName: z.string(),
      grantedOn: z.string(),
      note: z.string().nullable(),
    }),
  ),
  activities: z
    .array(
      z.object({
        id: z.string(),
        kind: activityKindSchema,
        name: z.string(),
        activityDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        description: z.string(),
        credits: z.number().nullable(),
      }),
    )
    .default([]),
  holidays: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .default([]),
});

export const importSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => importSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    await sql`delete from holidays where user_id = ${uid}`;
    await sql`delete from activities where user_id = ${uid}`;
    await sql`delete from credit_grants where user_id = ${uid}`;
    await sql`delete from attendance where user_id = ${uid}`;
    await sql`delete from periods where user_id = ${uid}`;
    await sql`delete from subjects where user_id = ${uid}`;
    await sql`delete from semesters where user_id = ${uid}`;
    await sql`delete from terms where user_id = ${uid}`;
    await sql`delete from profiles where user_id = ${uid}`;

    if (data.profile) {
      const t = data.profile.thresholdPercent ?? 75;
      await sql`
        insert into profiles (user_id, student_name, student_id, college_name, threshold_percent, timezone, session)
        values (${uid}, ${data.profile.studentName}, ${data.profile.studentId}, ${data.profile.collegeName}, ${t}, ${data.profile.timezone ?? null}, ${data.profile.session ?? null})
      `;
    }
    for (const t of data.terms) {
      await sql`
        insert into terms (id, user_id, name, start_date, end_date, is_active, classes_over)
        values (${t.id}, ${uid}, ${t.name}, ${t.startDate ?? null}, ${t.endDate ?? null}, ${t.isActive}, ${t.classesOver ?? false})
      `;
    }
    for (const s of data.semesters) {
      await sql`
        insert into semesters (id, user_id, term_id, course_name, semester_name, start_date, is_active, classes_over)
        values (${s.id}, ${uid}, ${s.termId ?? null}, ${s.courseName}, ${s.semesterName}, ${s.startDate}, ${s.isActive}, ${s.classesOver})
      `;
    }
    for (const s of data.subjects) {
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description, closed, origin_subject_id)
        values (${s.id}, ${uid}, ${s.semesterId}, ${s.name}, ${s.code}, ${s.defaultTeacher}, ${s.description ?? null}, ${s.closed}, ${s.originSubjectId ?? null})
      `;
    }
    for (const p of data.periods) {
      await sql`
        insert into periods (id, user_id, semester_id, subject_id, day_of_week, period_number, start_time, end_time, teacher_name)
        values (${p.id}, ${uid}, ${p.semesterId}, ${p.subjectId}, ${p.dayOfWeek}, ${p.periodNumber}, ${p.startTime}, ${p.endTime}, ${p.teacherName})
      `;
    }
    for (const a of data.attendance) {
      await sql`
        insert into attendance (id, user_id, period_id, date, status)
        values (${a.id}, ${uid}, ${a.periodId}, ${a.date}, ${a.status})
      `;
    }
    for (const c of data.credits) {
      await sql`
        insert into credit_grants (id, user_id, subject_id, amount, type, teacher_name, granted_on, note)
        values (${c.id}, ${uid}, ${c.subjectId}, ${c.amount}, ${c.type}, ${c.teacherName}, ${c.grantedOn}, ${c.note})
      `;
    }
    for (const a of data.activities) {
      await sql`
        insert into activities (id, user_id, kind, name, activity_date, start_time, end_time, description, credits)
        values (${a.id}, ${uid}, ${a.kind}, ${a.name}, ${a.activityDate}, ${a.startTime}, ${a.endTime}, ${a.description}, ${a.credits})
      `;
    }
    for (const h of data.holidays) {
      await sql`
        insert into holidays (id, user_id, name, start_date, end_date)
        values (${h.id}, ${uid}, ${h.name}, ${h.startDate}, ${h.endDate})
      `;
    }
    return { ok: true as const };
  });

// ── Shared Routines ───────────────────────────────────────────────────────────

export const createSharedRoutine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ semesterId: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    const [sem] = await sql<SemesterRow>`select * from semesters where id = ${data.semesterId} and user_id = ${uid}`;
    if (!sem) throw new Error("Semester not found.");

    const subjects = await sql<SubjectRow>`select * from subjects where semester_id = ${data.semesterId} and user_id = ${uid}`;
    const periods = await sql<PeriodRow>`select * from periods where semester_id = ${data.semesterId} and user_id = ${uid}`;

    const payload = JSON.stringify({
      semester: { courseName: sem.course_name, semesterName: sem.semester_name },
      subjects: subjects.map(s => ({ id: s.id, name: s.name, code: s.code, defaultTeacher: s.default_teacher, description: s.description })),
      periods: periods.map(p => ({ subjectId: p.subject_id, dayOfWeek: p.day_of_week, periodNumber: p.period_number, startTime: p.start_time, endTime: p.end_time, teacherName: p.teacher_name })),
    });

    const id = newId().substring(0, 12);
    await sql`
      insert into shared_routines (id, user_id, payload, created_at)
      values (${id}, ${uid}, ${payload}, now())
    `;

    return { id };
  });

export const getSharedRoutinePreview = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: string }>`select payload from shared_routines where id = ${data.id}`;
    if (!rows[0]) throw new Error("Routine not found or has expired.");
    
    const payload = JSON.parse(rows[0].payload) as {
      semester: { courseName: string; semesterName: string };
      subjects: any[];
      periods: any[];
    };

    return {
      courseName: payload.semester.courseName,
      semesterName: payload.semester.semesterName,
      subjectCount: payload.subjects.length,
      periodCount: payload.periods.length,
    };
  });

export const importSharedRoutine = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    const rows = await sql<{ payload: string }>`select payload from shared_routines where id = ${data.id}`;
    if (!rows[0]) throw new Error("Routine not found or has expired.");

    const payload = JSON.parse(rows[0].payload) as {
      semester: { courseName: string; semesterName: string };
      subjects: Array<{ id: string; name: string; code: string | null; defaultTeacher: string | null; description: string | null }>;
      periods: Array<{ subjectId: string; dayOfWeek: number; periodNumber: number; startTime: string; endTime: string; teacherName: string }>;
    };

    // Mark other semesters inactive
    await sql`update semesters set is_active = false where user_id = ${uid}`;

    const newSemId = newId();
    await sql`
      insert into semesters (id, user_id, course_name, semester_name, start_date, is_active)
      values (${newSemId}, ${uid}, ${payload.semester.courseName}, ${payload.semester.semesterName}, now()::date, true)
    `;

    const subjectIdMap = new Map<string, string>();
    for (const s of payload.subjects) {
      const newSubId = newId();
      subjectIdMap.set(s.id, newSubId);
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description)
        values (${newSubId}, ${uid}, ${newSemId}, ${s.name}, ${s.code}, ${s.defaultTeacher}, ${s.description})
      `;
    }

    for (const p of payload.periods) {
      const mappedSubId = subjectIdMap.get(p.subjectId);
      if (!mappedSubId) continue;
      
      const newPeriodId = newId();
      await sql`
        insert into periods (id, user_id, semester_id, subject_id, day_of_week, period_number, start_time, end_time, teacher_name)
        values (${newPeriodId}, ${uid}, ${newSemId}, ${mappedSubId}, ${p.dayOfWeek}, ${p.periodNumber}, ${p.startTime}, ${p.endTime}, ${p.teacherName})
      `;
    }

    return { newSemesterId: newSemId };
  });

// Account Deletion
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;

    const users = await sql<{ email: string }>`select email from "user" where id = ${uid}`;
    if (!users[0]) throw new Error("User not found.");
    const userEmail = users[0].email;

    const check = await auth.api.signInEmail({
      body: { email: userEmail, password: data.password },
      asResponse: true,
    });
    if (!check.ok) {
      throw new Error("Incorrect password. Deletion cancelled.");
    }

    const [profiles, semesters, subjects, periods, attendance, credits, activities, holidays] =
      await Promise.all([
        sql<ProfileRow>`select student_name, student_id, college_name, threshold_percent, (avatar_data is not null) as has_avatar, deletion_requested_at, scheduled_deletion_date from profiles where user_id = ${uid}`,
        sql<SemesterRow>`select id, course_name, semester_name, start_date, is_active, classes_over from semesters where user_id = ${uid}`,
        sql<SubjectRow>`select id, semester_id, name, code, default_teacher, description, closed from subjects where user_id = ${uid}`,
        sql<PeriodRow>`select id, semester_id, subject_id, day_of_week, period_number, start_time, end_time, teacher_name from periods where user_id = ${uid}`,
        sql<AttendanceRow>`select id, period_id, date, status from attendance where user_id = ${uid}`,
        sql<CreditRow>`select id, subject_id, amount, type, teacher_name, granted_on, note from credit_grants where user_id = ${uid}`,
        sql<ActivityRow>`select id, kind, name, activity_date, start_time, end_time, description, credits from activities where user_id = ${uid}`,
        sql<HolidayRow>`select id, name, start_date, end_date from holidays where user_id = ${uid}`,
      ]);

    const snapshot = {
      profile: profiles[0] ? mapProfile(profiles[0]) : null,
      semesters: semesters.map(mapSemester),
      subjects: subjects.map(mapSubject),
      periods: periods.map(mapPeriod),
      attendance: attendance.map(mapAttendance),
      credits: credits.map(mapCredit),
      activities: activities.map(mapActivity),
      holidays: holidays.map(mapHoliday),
    };

    const totalSemesters = semesters.length;
    const totalSubjects = subjects.length;
    const totalPeriodsLogged = attendance.length;
    const presentMarks = attendance.filter((a) => a.status === "present").length;
    const overallAttendancePercent = totalPeriodsLogged > 0 ? Math.round((presentMarks / totalPeriodsLogged) * 100) : 0;

    const archiveId = newId();

    await sql`
      insert into deleted_user_archives (
        id, user_id, college_name, student_id, total_semesters, total_subjects,
        total_periods_logged, overall_attendance_percent, snapshot_data
      ) values (
        ${archiveId}, ${uid}, ${profiles[0]?.college_name ?? ""}, ${profiles[0]?.student_id ?? ""},
        ${totalSemesters}, ${totalSubjects}, ${totalPeriodsLogged}, ${overallAttendancePercent},
        ${JSON.stringify(snapshot)}
      )
    `;

    await sql`
      update profiles set
        deletion_requested_at = now(),
        scheduled_deletion_date = now() + interval '7 days'
      where user_id = ${uid}
    `;

    await sql`delete from "session" where "userId" = ${uid}`;

    const updated = await sql<{ scheduled: string }>`select scheduled_deletion_date as scheduled from profiles where user_id = ${uid}`;

    return { success: true, scheduledDate: updated[0].scheduled };
  });

export const cancelAccountDeletion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      update profiles set
        deletion_requested_at = null,
        scheduled_deletion_date = null
      where user_id = ${context.userId}
    `;
    return { success: true };
  });

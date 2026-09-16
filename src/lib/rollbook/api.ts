import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";
import type {
  AttendanceEntry,
  AttendanceStatus,
  CreditGrant,
  CreditType,
  Period,
  Profile,
  Semester,
  Snapshot,
  Subject,
} from "./types";

const statusSchema = z.enum(["present", "absent", "holiday", "cancelled"]);
const creditTypeSchema = z.enum(["notes", "assignment", "project", "other"]);

type ProfileRow = {
  student_name: string;
  student_id: string;
  college_name: string;
  threshold_percent: number;
  has_avatar: boolean;
};
type SemesterRow = {
  id: string;
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

function mapProfile(r: ProfileRow): Profile {
  return {
    studentName: r.student_name,
    studentId: r.student_id,
    collegeName: r.college_name,
    thresholdPercent: Number(r.threshold_percent),
    hasAvatar: Boolean(r.has_avatar),
  };
}
function mapSemester(r: SemesterRow): Semester {
  return {
    id: r.id,
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

function isUniqueViolation(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /unique|duplicate|constraint/i.test(msg);
}

export const getSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Snapshot> => {
    const sql = await getSql();
    const uid = context.userId;
    const [profiles, semesters, subjects, periods, attendance, credits] =
      await Promise.all([
        sql<ProfileRow>`select student_name, student_id, college_name, threshold_percent, (avatar_data is not null) as has_avatar from profiles where user_id = ${uid}`,
        sql<SemesterRow>`select id, course_name, semester_name, start_date, is_active, classes_over from semesters where user_id = ${uid} order by created_at desc`,
        sql<SubjectRow>`select id, semester_id, name, code, default_teacher, description, closed from subjects where user_id = ${uid} order by created_at`,
        sql<PeriodRow>`select id, semester_id, subject_id, day_of_week, period_number, start_time, end_time, teacher_name from periods where user_id = ${uid} order by day_of_week, period_number`,
        sql<AttendanceRow>`select id, period_id, date, status from attendance where user_id = ${uid}`,
        sql<CreditRow>`select id, subject_id, amount, type, teacher_name, granted_on, note from credit_grants where user_id = ${uid} order by granted_on desc`,
      ]);
    return {
      profile: profiles[0] ? mapProfile(profiles[0]) : null,
      semesters: semesters.map(mapSemester),
      subjects: subjects.map(mapSubject),
      periods: periods.map(mapPeriod),
      attendance: attendance.map(mapAttendance),
      credits: credits.map(mapCredit),
    };
  });

const profileInput = z.object({
  studentName: z.string().trim().min(1).max(120),
  studentId: z.string().trim().min(1).max(80),
  collegeName: z.string().trim().min(1).max(160),
  thresholdPercent: z.number().int().min(50).max(100).optional(),
});

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => profileInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const threshold = data.thresholdPercent ?? 75;
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
    return { ok: true as const };
  });

const semesterInput = z.object({
  id: z.string().optional(),
  courseName: z.string().trim().min(1).max(160),
  semesterName: z.string().trim().min(1).max(80),
  startDate: z.string().nullable().optional(),
  makeActive: z.boolean().optional(),
});

export const upsertSemester = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => semesterInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    const id = data.id ?? newId();
    const start = data.startDate || null;
    if (data.makeActive !== false) {
      await sql`update semesters set is_active = false where user_id = ${uid}`;
    }
    if (data.id) {
      await sql`
        update semesters
        set course_name = ${data.courseName},
            semester_name = ${data.semesterName},
            start_date = ${start}
        where id = ${id} and user_id = ${uid}
      `;
    } else {
      await sql`
        insert into semesters (id, user_id, course_name, semester_name, start_date, is_active)
        values (${id}, ${uid}, ${data.courseName}, ${data.semesterName}, ${start}, true)
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

const periodInput = z.object({
  id: z.string().optional(),
  semesterId: z.string(),
  subjectId: z.string(),
  dayOfWeek: z.number().int().min(1).max(6),
  periodNumber: z.number().int().min(1).max(12),
  startTime: z.string().min(4).max(8),
  endTime: z.string().min(4).max(8),
  teacherName: z.string().trim().max(120).optional(),
});

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
    const owned = await sql<{ id: string }>`
      select id from periods where id = ${data.periodId} and user_id = ${uid}
    `;
    if (!owned[0]) throw new Error("Period not found.");
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
});

/**
 * Archives the current semester's routine by:
 * 1. Marking the current semester inactive and classesOver=true
 * 2. Creating a new semester (same courseName, new semesterName) as active
 * 3. Copying all subjects across (no periods — blank slate for the new routine)
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
      select id, course_name, semester_name, start_date, is_active, classes_over
      from semesters where id = ${data.semesterId} and user_id = ${uid}
    `;
    if (!sem) throw new Error("Semester not found.");

    // Fetch subjects for this semester
    const subjects = await sql<SubjectRow>`
      select id, semester_id, name, code, default_teacher, description, closed
      from subjects where semester_id = ${data.semesterId} and user_id = ${uid}
      order by created_at
    `;

    // Archive old semester
    await sql`
      update semesters
      set is_active = false, classes_over = true
      where id = ${data.semesterId} and user_id = ${uid}
    `;

    // Create new active semester
    const newSemId = newId();
    await sql`
      insert into semesters (id, user_id, course_name, semester_name, start_date, is_active)
      values (${newSemId}, ${uid}, ${sem.course_name}, ${data.newSemesterName}, now()::date, true)
    `;

    // Copy subjects (reset closed flag, no periods)
    const idMap: Record<string, string> = {};
    for (const s of subjects) {
      const newSubId = newId();
      idMap[s.id] = newSubId;
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description)
        values (${newSubId}, ${uid}, ${newSemId}, ${s.name}, ${s.code}, ${s.default_teacher}, ${s.description ?? null})
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
  semesters: z.array(
    z.object({
      id: z.string(),
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
});

export const importSnapshot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => importSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const uid = context.userId;
    await sql`delete from credit_grants where user_id = ${uid}`;
    await sql`delete from attendance where user_id = ${uid}`;
    await sql`delete from periods where user_id = ${uid}`;
    await sql`delete from subjects where user_id = ${uid}`;
    await sql`delete from semesters where user_id = ${uid}`;
    await sql`delete from profiles where user_id = ${uid}`;

    if (data.profile) {
      const t = data.profile.thresholdPercent ?? 75;
      await sql`
        insert into profiles (user_id, student_name, student_id, college_name, threshold_percent)
        values (${uid}, ${data.profile.studentName}, ${data.profile.studentId}, ${data.profile.collegeName}, ${t})
      `;
    }
    for (const s of data.semesters) {
      await sql`
        insert into semesters (id, user_id, course_name, semester_name, start_date, is_active, classes_over)
        values (${s.id}, ${uid}, ${s.courseName}, ${s.semesterName}, ${s.startDate}, ${s.isActive}, ${s.classesOver})
      `;
    }
    for (const s of data.subjects) {
      await sql`
        insert into subjects (id, user_id, semester_id, name, code, default_teacher, description, closed)
        values (${s.id}, ${uid}, ${s.semesterId}, ${s.name}, ${s.code}, ${s.defaultTeacher}, ${s.description ?? null}, ${s.closed})
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
    return { ok: true as const };
  });

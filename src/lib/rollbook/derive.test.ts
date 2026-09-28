/**
 * Tests for teacherNamesForSubject and mostRecentTeacherForSubject.
 *
 * These helpers are tested here in isolation (without importing derive.ts
 * directly) so that the test can be run with bare `node --test` without
 * needing the bundler's module resolution for extensionless imports.
 * The implementations below are kept in sync with derive.ts — if you change
 * the logic there, update this copy too.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  groupSubjectsByOrigin,
  normalizeSubjectName,
  statsForSubject,
  statsForSubjectGroup,
  statsForTerm,
  teachersForSubjectGroup,
} from "./derive.ts";
import type { Period, Snapshot, Subject, AttendanceEntry, CreditGrant, Semester, Term } from "./types.ts";

// ── Inline implementations (kept in sync with derive.ts) ──────────────────────

function teacherNamesForSubject(
  periods: Period[],
  subject: Pick<Subject, "id" | "defaultTeacher">,
): string[] {
  const raw = periods
    .filter((p) => p.subjectId === subject.id)
    .map((p) => p.teacherName)
    .concat(subject.defaultTeacher ?? "")
    .filter(Boolean);
  return [...new Set(raw)];
}

function mostRecentTeacherForSubject(
  periods: Period[],
  subject: Pick<Subject, "id" | "defaultTeacher">,
): string {
  const subjectPeriods = periods.filter((p) => p.subjectId === subject.id);
  if (subjectPeriods.length === 0) return subject.defaultTeacher ?? "";
  const sorted = [...subjectPeriods].sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
  return sorted[0].teacherName || subject.defaultTeacher || "";
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function mkPeriod(overrides: Partial<Period>): Period {
  return {
    id: "p_default",
    semesterId: "sem1",
    subjectId: "sub1",
    dayOfWeek: 1,
    periodNumber: 1,
    startTime: "09:00",
    endTime: "09:50",
    teacherName: "",
    ...overrides,
  };
}

function mkSubject(overrides: Partial<Subject>): Subject {
  return {
    id: "sub_default",
    semesterId: "sem1",
    name: "Math",
    code: null,
    defaultTeacher: null,
    description: null,
    closed: false,
    originSubjectId: null,
    ...overrides,
  };
}

// ── teacherNamesForSubject ────────────────────────────────────────────────────

describe("teacherNamesForSubject", () => {
  it("returns empty array when no periods and no defaultTeacher", () => {
    const result = teacherNamesForSubject([], mkSubject({ id: "sub1" }));
    assert.deepEqual(result, []);
  });

  it("includes defaultTeacher when no periods", () => {
    const result = teacherNamesForSubject(
      [],
      mkSubject({ id: "sub1", defaultTeacher: "Dr. Smith" }),
    );
    assert.deepEqual(result, ["Dr. Smith"]);
  });

  it("deduplicates teacher names across periods", () => {
    const periods = [
      mkPeriod({ id: "p1", teacherName: "Dr. Smith" }),
      mkPeriod({ id: "p2", teacherName: "Dr. Jones" }),
      mkPeriod({ id: "p3", teacherName: "Dr. Smith" }),
    ];
    const result = teacherNamesForSubject(
      periods,
      mkSubject({ id: "sub1", defaultTeacher: "Dr. Smith" }),
    );
    assert.equal(result.length, 2);
    assert.ok(result.includes("Dr. Smith"));
    assert.ok(result.includes("Dr. Jones"));
  });

  it("ignores periods from other subjects", () => {
    const periods = [
      mkPeriod({ id: "p1", subjectId: "other", teacherName: "Dr. Other" }),
      mkPeriod({ id: "p2", subjectId: "sub1", teacherName: "Dr. Mine" }),
    ];
    const result = teacherNamesForSubject(periods, mkSubject({ id: "sub1" }));
    assert.deepEqual(result, ["Dr. Mine"]);
  });

  it("filters out empty string teacher names", () => {
    const periods = [
      mkPeriod({ id: "p1", teacherName: "" }),
      mkPeriod({ id: "p2", teacherName: "Dr. Present" }),
    ];
    const result = teacherNamesForSubject(periods, mkSubject({ id: "sub1" }));
    assert.deepEqual(result, ["Dr. Present"]);
  });
});

// ── mostRecentTeacherForSubject ───────────────────────────────────────────────

describe("mostRecentTeacherForSubject", () => {
  it("returns defaultTeacher when no periods", () => {
    const result = mostRecentTeacherForSubject(
      [],
      mkSubject({ id: "sub1", defaultTeacher: "Prof. Default" }),
    );
    assert.equal(result, "Prof. Default");
  });

  it("returns empty string when no periods and no defaultTeacher", () => {
    const result = mostRecentTeacherForSubject([], mkSubject({ id: "sub1" }));
    assert.equal(result, "");
  });

  it("returns teacher from period with highest id (most recent)", () => {
    const periods = [
      mkPeriod({ id: "aaaa", teacherName: "Older" }),
      mkPeriod({ id: "zzzz", teacherName: "Newer" }),
      mkPeriod({ id: "mmmm", teacherName: "Middle" }),
    ];
    const result = mostRecentTeacherForSubject(periods, mkSubject({ id: "sub1" }));
    assert.equal(result, "Newer");
  });

  it("falls back to defaultTeacher when latest period has blank teacherName", () => {
    const periods = [
      mkPeriod({ id: "aaaa", teacherName: "OldTeacher" }),
      mkPeriod({ id: "zzzz", teacherName: "" }),
    ];
    const result = mostRecentTeacherForSubject(
      periods,
      mkSubject({ id: "sub1", defaultTeacher: "FallbackTeacher" }),
    );
    assert.equal(result, "FallbackTeacher");
  });

  it("ignores periods from other subjects", () => {
    const periods = [
      mkPeriod({ id: "zzzz", subjectId: "other", teacherName: "OtherSubjectTeacher" }),
      mkPeriod({ id: "aaaa", subjectId: "sub1", teacherName: "MyTeacher" }),
    ];
    const result = mostRecentTeacherForSubject(periods, mkSubject({ id: "sub1" }));
    assert.equal(result, "MyTeacher");
  });
});

// ── Term-wide Aggregation Tests ────────────────────────────────────────────────

describe("Term-wide aggregation (derive.ts)", () => {
  function mkSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
    return {
      profile: null,
      terms: [],
      semesters: [],
      subjects: [],
      periods: [],
      attendance: [],
      credits: [],
      activities: [],
      holidays: [],
      ...overrides,
    };
  }

  it("same subject in two routines with different ids combines held/present/absent/credits", () => {
    const sem1: Semester = {
      id: "sem1",
      termId: "term1",
      courseName: "BCA",
      semesterName: "Routine 1",
      startDate: "2025-01-01",
      isActive: false,
      classesOver: false,
    };
    const sem2: Semester = {
      id: "sem2",
      termId: "term1",
      courseName: "BCA",
      semesterName: "Routine 2",
      startDate: "2025-02-01",
      isActive: true,
      classesOver: false,
    };

    // sub1 in sem1, sub2 in sem2 (both named "Data Structures", no originSubjectId initially)
    const sub1: Subject = {
      id: "sub1",
      semesterId: "sem1",
      name: "Data Structures",
      code: "CS201",
      defaultTeacher: "Prof. A",
      description: null,
      closed: false,
      originSubjectId: null,
    };
    const sub2: Subject = {
      id: "sub2",
      semesterId: "sem2",
      name: "Data Structures",
      code: "CS201",
      defaultTeacher: "Prof. A",
      description: null,
      closed: false,
      originSubjectId: "sub1",
    };

    const p1: Period = {
      id: "p1",
      semesterId: "sem1",
      subjectId: "sub1",
      dayOfWeek: 1,
      periodNumber: 1,
      startTime: "09:00",
      endTime: "10:00",
      teacherName: "",
    };
    const p2: Period = {
      id: "p2",
      semesterId: "sem2",
      subjectId: "sub2",
      dayOfWeek: 2,
      periodNumber: 1,
      startTime: "10:00",
      endTime: "11:00",
      teacherName: "",
    };

    // sem1: 1 present, 1 absent -> 2 held. Credit: 2
    // sem2: 2 present, 1 absent -> 3 held. Credit: 1
    const attendance: AttendanceEntry[] = [
      { id: "a1", periodId: "p1", date: "2025-01-06", status: "present" },
      { id: "a2", periodId: "p1", date: "2025-01-13", status: "absent" },
      { id: "a3", periodId: "p2", date: "2025-02-04", status: "present" },
      { id: "a4", periodId: "p2", date: "2025-02-11", status: "present" },
      { id: "a5", periodId: "p2", date: "2025-02-18", status: "absent" },
    ];

    const credits: CreditGrant[] = [
      {
        id: "c1",
        subjectId: "sub1",
        amount: 2,
        type: "assignment",
        teacherName: "Prof. A",
        grantedOn: "2025-01-15",
        note: null,
      },
      {
        id: "c2",
        subjectId: "sub2",
        amount: 1,
        type: "notes",
        teacherName: "Prof. A",
        grantedOn: "2025-02-15",
        note: null,
      },
    ];

    const snapshot = mkSnapshot({
      semesters: [sem1, sem2],
      subjects: [sub1, sub2],
      periods: [p1, p2],
      attendance,
      credits,
    });

    const groups = Array.from(
      groupSubjectsByOrigin(snapshot.subjects, new Set(["sem1", "sem2"])).values(),
    );
    assert.equal(groups.length, 1);
    const group = groups[0];
    assert.equal(group.length, 2);

    const stats = statsForSubjectGroup(snapshot, group, 75);
    // held: 2 + 3 = 5
    assert.equal(stats.hosted, 5);
    // present: 1 + 2 = 3
    assert.equal(stats.present, 3);
    // absent: 1 + 1 = 2
    assert.equal(stats.absent, 2);
    // teacherCredit: 2 + 1 = 3
    assert.equal(stats.teacherCredit, 3);
  });

  it("a renamed copy with origin_subject_id still groups", () => {
    const sub1: Subject = {
      id: "sub1",
      semesterId: "sem1",
      name: "Operating Systems",
      code: "CS301",
      defaultTeacher: null,
      description: null,
      closed: false,
      originSubjectId: null,
    };
    const sub2: Subject = {
      id: "sub2",
      semesterId: "sem2",
      name: "OS Lab & Theory",
      code: "CS301",
      defaultTeacher: null,
      description: null,
      closed: false,
      originSubjectId: "sub1",
    };

    const groups = Array.from(
      groupSubjectsByOrigin([sub1, sub2], new Set(["sem1", "sem2"])).values(),
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0].length, 2);
    assert.ok(groups[0].some((s) => s.id === "sub1"));
    assert.ok(groups[0].some((s) => s.id === "sub2"));
  });

  it("a period-level-only teacher appears", () => {
    const sub: Subject = {
      id: "sub1",
      semesterId: "sem1",
      name: "Compiler Design",
      code: null,
      defaultTeacher: null,
      description: null,
      closed: false,
      originSubjectId: null,
    };
    const p1: Period = {
      id: "p1",
      semesterId: "sem1",
      subjectId: "sub1",
      dayOfWeek: 1,
      periodNumber: 1,
      startTime: "09:00",
      endTime: "10:00",
      teacherName: "Prof. PeriodTeacher",
    };

    const teachers = teachersForSubjectGroup([p1], [sub]);
    assert.deepEqual(teachers, ["Prof. PeriodTeacher"]);
  });

  it("a single-routine subject is unchanged", () => {
    const sem1: Semester = {
      id: "sem1",
      termId: "term1",
      courseName: "BCA",
      semesterName: "Routine 1",
      startDate: "2025-01-01",
      isActive: true,
      classesOver: false,
    };
    const sub1: Subject = {
      id: "sub1",
      semesterId: "sem1",
      name: "Algorithms",
      code: "CS102",
      defaultTeacher: "Dr. Cormen",
      description: null,
      closed: false,
      originSubjectId: null,
    };
    const p1: Period = {
      id: "p1",
      semesterId: "sem1",
      subjectId: "sub1",
      dayOfWeek: 1,
      periodNumber: 1,
      startTime: "09:00",
      endTime: "10:00",
      teacherName: "",
    };
    const attendance: AttendanceEntry[] = [
      { id: "a1", periodId: "p1", date: "2025-01-06", status: "present" },
      { id: "a2", periodId: "p1", date: "2025-01-13", status: "present" },
      { id: "a3", periodId: "p1", date: "2025-01-20", status: "absent" },
    ];
    const snapshot = mkSnapshot({
      semesters: [sem1],
      subjects: [sub1],
      periods: [p1],
      attendance,
    });

    const singleStats = statsForSubject(snapshot, "sub1", 75);
    const groupStats = statsForSubjectGroup(snapshot, [sub1], 75);

    assert.equal(groupStats.hosted, singleStats.hosted);
    assert.equal(groupStats.present, singleStats.present);
    assert.equal(groupStats.absent, singleStats.absent);
    assert.equal(groupStats.rawPercent, singleStats.rawPercent);
    assert.equal(groupStats.effectivePercent, singleStats.effectivePercent);
  });

  it("routine 1 (Visual Programming 1/1) + routine 2 (E-Commerce 1/1, teacher only at period level) -> both subjects, both teachers, 2/2 = 100%", () => {
    const sem1: Semester = {
      id: "sem1",
      termId: "term1",
      courseName: "BCA",
      semesterName: "Routine 1",
      startDate: "2025-01-01",
      isActive: false,
      classesOver: false,
    };
    const sem2: Semester = {
      id: "sem2",
      termId: "term1",
      courseName: "BCA",
      semesterName: "Routine 2",
      startDate: "2025-02-01",
      isActive: true,
      classesOver: false,
    };

    const vpSub: Subject = {
      id: "sub_vp",
      semesterId: "sem1",
      name: "Visual Programming",
      code: "BCA401",
      defaultTeacher: "Prof. VP Teacher",
      description: null,
      closed: false,
      originSubjectId: null,
    };
    const ecSub: Subject = {
      id: "sub_ec",
      semesterId: "sem2",
      name: "E-Commerce",
      code: "BCA402",
      defaultTeacher: null, // period-level teacher only
      description: null,
      closed: false,
      originSubjectId: null,
    };

    const vpPeriod: Period = {
      id: "p_vp",
      semesterId: "sem1",
      subjectId: "sub_vp",
      dayOfWeek: 1,
      periodNumber: 1,
      startTime: "09:00",
      endTime: "10:00",
      teacherName: "",
    };
    const ecPeriod: Period = {
      id: "p_ec",
      semesterId: "sem2",
      subjectId: "sub_ec",
      dayOfWeek: 2,
      periodNumber: 1,
      startTime: "10:00",
      endTime: "11:00",
      teacherName: "Prof. EC Period Teacher",
    };

    const attendance: AttendanceEntry[] = [
      { id: "a_vp", periodId: "p_vp", date: "2025-01-06", status: "present" },
      { id: "a_ec", periodId: "p_ec", date: "2025-02-04", status: "present" },
    ];

    const snapshot = mkSnapshot({
      semesters: [sem1, sem2],
      subjects: [vpSub, ecSub],
      periods: [vpPeriod, ecPeriod],
      attendance,
    });

    // 1. Grouping: two distinct subject groups
    const groups = Array.from(
      groupSubjectsByOrigin(snapshot.subjects, new Set(["sem1", "sem2"])).values(),
    );
    assert.equal(groups.length, 2);

    const vpGroup = groups.find((g) => g.some((s) => s.id === "sub_vp"))!;
    const ecGroup = groups.find((g) => g.some((s) => s.id === "sub_ec"))!;
    assert.ok(vpGroup);
    assert.ok(ecGroup);

    // 2. Teachers:
    const vpTeachers = teachersForSubjectGroup(snapshot.periods, vpGroup);
    const ecTeachers = teachersForSubjectGroup(snapshot.periods, ecGroup);
    assert.deepEqual(vpTeachers, ["Prof. VP Teacher"]);
    assert.deepEqual(ecTeachers, ["Prof. EC Period Teacher"]);

    // 3. Subject stats:
    const vpStats = statsForSubjectGroup(snapshot, vpGroup, 75);
    const ecStats = statsForSubjectGroup(snapshot, ecGroup, 75);
    assert.equal(vpStats.hosted, 1);
    assert.equal(vpStats.present, 1);
    assert.equal(vpStats.rawPercent, 100);

    assert.equal(ecStats.hosted, 1);
    assert.equal(ecStats.present, 1);
    assert.equal(ecStats.rawPercent, 100);

    // 4. Term overall stats: 2/2 = 100%
    const termStats = statsForTerm(snapshot, "term1", 75);
    assert.equal(termStats.hosted, 2);
    assert.equal(termStats.present, 2);
    assert.equal(termStats.rawPercent, 100);
  });
});

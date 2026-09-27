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

// ── Inline implementations (kept in sync with derive.ts) ──────────────────────

function teacherNamesForSubject(periods, subject) {
  const raw = periods
    .filter((p) => p.subjectId === subject.id)
    .map((p) => p.teacherName)
    .concat(subject.defaultTeacher ?? "")
    .filter(Boolean);
  return [...new Set(raw)];
}

function mostRecentTeacherForSubject(periods, subject) {
  const subjectPeriods = periods.filter((p) => p.subjectId === subject.id);
  if (subjectPeriods.length === 0) return subject.defaultTeacher ?? "";
  const sorted = [...subjectPeriods].sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
  return sorted[0].teacherName || subject.defaultTeacher || "";
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function mkPeriod(overrides) {
  return {
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

function mkSubject(overrides) {
  return {
    semesterId: "sem1",
    name: "Math",
    code: null,
    defaultTeacher: null,
    description: null,
    closed: false,
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

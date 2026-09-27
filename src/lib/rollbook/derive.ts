import { tallyMarks } from "./stats";
import type { AttendanceStats, Period, Snapshot, Subject } from "./types";

export function statsForSubject(
  snapshot: Snapshot,
  subjectId: string,
  threshold: number,
): AttendanceStats {
  const periodIds = new Set(
    snapshot.periods.filter((p) => p.subjectId === subjectId).map((p) => p.id),
  );
  const entries = snapshot.attendance.filter((a) => periodIds.has(a.periodId));
  const credits = snapshot.credits.filter((c) => c.subjectId === subjectId);
  return tallyMarks(entries, credits, threshold);
}

export function statsForSemester(
  snapshot: Snapshot,
  semesterId: string,
  threshold: number,
): AttendanceStats {
  const subjectIds = new Set(
    snapshot.subjects.filter((s) => s.semesterId === semesterId).map((s) => s.id),
  );
  const periodIds = new Set(
    snapshot.periods.filter((p) => p.semesterId === semesterId).map((p) => p.id),
  );
  const entries = snapshot.attendance.filter((a) => periodIds.has(a.periodId));
  const credits = snapshot.credits.filter((c) => subjectIds.has(c.subjectId));
  return tallyMarks(entries, credits, threshold);
}

export function subjectById(snapshot: Snapshot, id: string) {
  return snapshot.subjects.find((s) => s.id === id);
}

/**
 * Returns the deduplicated, non-empty set of teacher names used across all
 * periods for `subject`, plus the subject's own defaultTeacher.
 * Suitable for populating a <datalist> autocomplete.
 */
export function teacherNamesForSubject(
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

/**
 * Returns the teacher name from the "most recently created" period for a
 * subject. Since periods have no dedicated timestamp we use the highest id
 * (insertion-order proxy). Falls back to subject.defaultTeacher, then "".
 */
export function mostRecentTeacherForSubject(
  periods: Period[],
  subject: Pick<Subject, "id" | "defaultTeacher">,
): string {
  const subjectPeriods = periods.filter((p) => p.subjectId === subject.id);
  if (subjectPeriods.length === 0) return subject.defaultTeacher ?? "";
  // Sort descending by id (lexicographic; ULIDs / cuid2 both sort by time)
  const sorted = [...subjectPeriods].sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
  return sorted[0].teacherName || subject.defaultTeacher || "";
}

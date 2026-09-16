import { tallyMarks } from "./stats";
import type { AttendanceStats, Snapshot } from "./types";

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

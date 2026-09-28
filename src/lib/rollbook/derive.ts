import { tallyMarks } from "./stats.ts";
import type { AttendanceStats, Period, Snapshot, Subject } from "./types.ts";

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

/**
 * Normalizes a subject name by trimming, lowercasing, and collapsing whitespace.
 */
export function normalizeSubjectName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * For term-wide reporting: groups subjects by their canonical "origin" id,
 * falling back to normalized-name grouping when originSubjectId is null.
 *
 * When archiveRoutine() carries subjects forward it stamps originSubjectId.
 * A subject with no originSubjectId falls back to normalized name matching.
 *
 * Returns a map: canonicalKey → Subject[] (all routines in this term,
 * ordered by creation order).
 *
 * Only subjects belonging to the provided semesterIds are considered, so
 * callers must pre-filter to the semesters within their target term.
 */
export function groupSubjectsByOrigin(
  subjectsOrSnapshot: Subject[] | Snapshot,
  semesterIds?: Set<string>,
): Map<string, Subject[]> {
  const subjects = Array.isArray(subjectsOrSnapshot)
    ? subjectsOrSnapshot
    : subjectsOrSnapshot.subjects;
  const inScope = semesterIds
    ? subjects.filter((s) => semesterIds.has(s.semesterId))
    : subjects;
  if (inScope.length === 0) return new Map();

  const parent = new Map<string, string>();
  function find(x: string): string {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let curr = x;
    while (parent.has(curr) && parent.get(curr) !== root) {
      const next = parent.get(curr)!;
      parent.set(curr, root);
      curr = next;
    }
    return root;
  }
  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootB, rootA);
    }
  }

  // 1. Initialize union-find for each in-scope subject
  for (const s of inScope) {
    parent.set(s.id, s.id);
  }

  // 2. Union by originSubjectId if present
  for (const s of inScope) {
    if (s.originSubjectId) {
      if (!parent.has(s.originSubjectId)) {
        parent.set(s.originSubjectId, s.originSubjectId);
      }
      union(s.originSubjectId, s.id);
    }
  }

  // 3. Fall back to normalized-name grouping when originSubjectId is null
  const normMap = new Map<string, string>();
  for (const s of inScope) {
    const norm = normalizeSubjectName(s.name);
    const prevId = normMap.get(norm);
    if (prevId) {
      if (!s.originSubjectId) {
        union(prevId, s.id);
      }
    } else {
      normMap.set(norm, s.id);
    }
  }

  // 4. Collect results into groups
  const result = new Map<string, Subject[]>();
  for (const s of inScope) {
    const root = find(s.id);
    const list = result.get(root);
    if (list) {
      list.push(s);
    } else {
      result.set(root, [s]);
    }
  }
  return result;
}

/**
 * Calculates attendance statistics for a group of linked subjects across
 * routines in a term by unioning their attendance and credit grants.
 */
export function statsForSubjectGroup(
  snapshot: Snapshot,
  group: Subject[],
  threshold: number,
): AttendanceStats {
  const subjectIds = new Set(group.map((s) => s.id));
  const periodIds = new Set(
    snapshot.periods.filter((p) => subjectIds.has(p.subjectId)).map((p) => p.id),
  );
  const entries = snapshot.attendance.filter((a) => periodIds.has(a.periodId));
  const credits = snapshot.credits.filter((c) => subjectIds.has(c.subjectId));
  return tallyMarks(entries, credits, threshold);
}

/**
 * Calculates overall attendance statistics for an entire term (all routines linked to it).
 */
export function statsForTerm(
  snapshot: Snapshot,
  termId: string | null | undefined,
  threshold: number,
): AttendanceStats {
  let semIds: Set<string>;
  if (termId) {
    semIds = new Set(snapshot.semesters.filter((s) => s.termId === termId).map((s) => s.id));
  } else {
    const unlinked = snapshot.semesters.filter((s) => !s.termId);
    if (unlinked.length > 0) {
      semIds = new Set(unlinked.map((s) => s.id));
    } else {
      semIds = new Set(snapshot.semesters.map((s) => s.id));
    }
  }
  const periodIds = new Set(
    snapshot.periods.filter((p) => semIds.has(p.semesterId)).map((p) => p.id),
  );
  const subjectIds = new Set(
    snapshot.subjects.filter((s) => semIds.has(s.semesterId)).map((s) => s.id),
  );
  const entries = snapshot.attendance.filter((a) => periodIds.has(a.periodId));
  const credits = snapshot.credits.filter((c) => subjectIds.has(c.subjectId));
  return tallyMarks(entries, credits, threshold);
}

/**
 * Returns the deduplicated union of teacher names for a group of subjects
 * that represent the same course across multiple routines in a term.
 * Used in term-wide PDF/CSV reports.
 */
export function teachersForSubjectGroup(
  arg1: Period[] | Subject[],
  arg2: Period[] | Subject[],
): string[] {
  const isArg1Periods = arg1.length > 0 && "dayOfWeek" in arg1[0];
  const periods = (isArg1Periods ? arg1 : arg2) as Period[];
  const subjects = (isArg1Periods ? arg2 : arg1) as Subject[];
  const raw: string[] = [];
  for (const s of subjects) {
    for (const p of periods) {
      if (p.subjectId === s.id && p.teacherName) raw.push(p.teacherName);
    }
    if (s.defaultTeacher) raw.push(s.defaultTeacher);
  }
  return [...new Set(raw.filter(Boolean))];
}

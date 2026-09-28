export type AttendanceStatus = "present" | "absent" | "holiday" | "cancelled";
export type CreditType = "notes" | "assignment" | "project" | "other";

export type Profile = {
  studentName: string;
  studentId: string;
  collegeName: string;
  thresholdPercent: number;
  timezone: string | null;
  /** Academic session / year, e.g. "2025-26". Optional, user-editable. */
  session: string | null;
  hasAvatar?: boolean;
  deletionRequestedAt?: string | null;
  scheduledDeletionDate?: string | null;
};

/**
 * A Term is the top-level grouping above routines — one per "semester" in the
 * academic sense (e.g. "Odd Semester 2025-26"). A term contains one or more
 * Semester (routine) rows in the semesters table.
 */
export type Term = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  classesOver: boolean;
};

/**
 * A Semester is a *routine* — a concrete timetable slot arrangement within
 * a term. One term may have multiple routines (e.g. archive & start fresh).
 */
export type Semester = {
  id: string;
  /** FK to the parent term, if any. Null for legacy rows. */
  termId: string | null;
  courseName: string;
  semesterName: string;
  startDate: string | null;
  isActive: boolean;
  classesOver: boolean;
};

export type Subject = {
  id: string;
  semesterId: string;
  name: string;
  code: string | null;
  defaultTeacher: string | null;
  description: string | null;
  closed: boolean;
  /**
   * When a subject was carried forward from an archived routine via
   * archiveRoutine(), this field points to its origin subject id. Used for
   * term-wide attendance aggregation across routines.
   */
  originSubjectId: string | null;
};

export type Period = {
  id: string;
  semesterId: string;
  subjectId: string;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  teacherName: string;
};

export type AttendanceEntry = {
  id: string;
  periodId: string;
  date: string;
  status: AttendanceStatus;
};

export type CreditGrant = {
  id: string;
  subjectId: string;
  amount: number;
  type: CreditType;
  teacherName: string;
  grantedOn: string;
  note: string | null;
};

export type ActivityKind = "workshop" | "activity" | "fest" | "game" | "other";

export type Activity = {
  id: string;
  kind: ActivityKind;
  name: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  description: string;
  credits: number | null;
};

export type Holiday = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type Snapshot = {
  profile: Profile | null;
  terms: Term[];
  semesters: Semester[];
  subjects: Subject[];
  periods: Period[];
  attendance: AttendanceEntry[];
  credits: CreditGrant[];
  activities: Activity[];
  holidays: Holiday[];
};

export type AttendanceStats = {
  hosted: number;
  present: number;
  absent: number;
  holiday: number;
  cancelled: number;
  teacherCredit: number;
  rawPercent: number | null;
  effectivePercent: number | null;
  creditNeeded: number;
  bunkable: number;
  attendToClear: number;
};

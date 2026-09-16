export type AttendanceStatus = "present" | "absent" | "holiday" | "cancelled";
export type CreditType = "notes" | "assignment" | "project" | "other";

export type Profile = {
  studentName: string;
  studentId: string;
  collegeName: string;
  thresholdPercent: number;
};

export type Semester = {
  id: string;
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

export type Snapshot = {
  profile: Profile | null;
  semesters: Semester[];
  subjects: Subject[];
  periods: Period[];
  attendance: AttendanceEntry[];
  credits: CreditGrant[];
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
